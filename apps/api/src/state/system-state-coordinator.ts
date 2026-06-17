import type { ExecutionTrace } from '@arrivalos/profile';
import {
  getPersistedSystemStateStore,
  type PersistedSystemStateStore,
} from './persisted-system-state-store.js';
import {
  applyModuleExecute,
  applyProfileCreate,
  applyProfileUpdate,
  applySessionPatch,
  createInitialSystemState,
  getLatestExecutionTrace,
} from './system-state-apply.js';
import type { SystemState } from './system-state-types.js';
import type {
  ModuleExecuteMutation,
  ProfileCreateMutation,
  ProfileUpdateMutation,
  SessionCreateMutation,
  SessionPatchMutation,
  SystemMutation,
  SystemMutationResult,
} from './system-mutation-types.js';

type SessionCreateResult = Extract<SystemMutationResult, { type: 'SESSION_CREATE' }>;
type SessionPatchResult = Extract<SystemMutationResult, { type: 'SESSION_PATCH' }>;
type ProfileCreateResult = Extract<SystemMutationResult, { type: 'PROFILE_CREATE' }>;
type ProfileUpdateResult = Extract<SystemMutationResult, { type: 'PROFILE_UPDATE' }>;
type ModuleExecuteResult = Extract<SystemMutationResult, { type: 'MODULE_EXECUTE' }>;

export class SystemStateCoordinator {
  private readonly store: PersistedSystemStateStore;
  private readonly cache = new Map<string, SystemState>();
  private readonly mutationChains = new Map<string, Promise<unknown>>();

  constructor(store: PersistedSystemStateStore = getPersistedSystemStateStore()) {
    this.store = store;
  }

  resetCache(): void {
    this.cache.clear();
  }

  async getState(sessionId: string): Promise<SystemState | null> {
    const cached = this.cache.get(sessionId);
    if (cached) {
      return cached;
    }

    const loaded = await this.store.load(sessionId);
    if (loaded) {
      this.cache.set(sessionId, loaded);
    }
    return loaded;
  }

  async getLatestTrace(sessionId: string, moduleId: string): Promise<ExecutionTrace | null> {
    const state = await this.getState(sessionId);
    return state ? getLatestExecutionTrace(state, moduleId) : null;
  }

  async applyMutation(mutation: SessionCreateMutation): Promise<SessionCreateResult>;
  async applyMutation(mutation: SessionPatchMutation): Promise<SessionPatchResult>;
  async applyMutation(mutation: ProfileCreateMutation): Promise<ProfileCreateResult>;
  async applyMutation(mutation: ProfileUpdateMutation): Promise<ProfileUpdateResult>;
  async applyMutation(mutation: ModuleExecuteMutation): Promise<ModuleExecuteResult>;
  async applyMutation(mutation: SystemMutation): Promise<SystemMutationResult> {
    if (mutation.type === 'SESSION_CREATE') {
      return this.applyMutationInternal(mutation);
    }

    const sessionId = 'sessionId' in mutation ? mutation.sessionId : undefined;

    if (!sessionId) {
      return this.applyMutationInternal(mutation);
    }

    return this.enqueueSessionMutation(sessionId, () => this.applyMutationInternal(mutation));
  }

  private enqueueSessionMutation<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.mutationChains.get(sessionId) ?? Promise.resolve();
    const next = previous.then(task, task);
    this.mutationChains.set(sessionId, next);
    return next.finally(() => {
      if (this.mutationChains.get(sessionId) === next) {
        this.mutationChains.delete(sessionId);
      }
    }) as Promise<T>;
  }

  private async applyMutationInternal(mutation: SystemMutation): Promise<SystemMutationResult> {
    switch (mutation.type) {
      case 'SESSION_CREATE': {
        const state = createInitialSystemState({
          context: mutation.context,
          modules: mutation.modules,
          projectionConfig: mutation.projectionConfig,
          mutationId: `session-create:${Date.now()}`,
        });
        await this.store.save(state);
        this.cache.set(state.session.id, state);
        return { type: 'SESSION_CREATE', state };
      }
      case 'SESSION_PATCH': {
        const current = await this.requireState(mutation.sessionId, true);
        const state = applySessionPatch(current, mutation.context, mutation.mutationId);
        await this.store.save(state);
        this.cache.set(state.session.id, state);
        return { type: 'SESSION_PATCH', state };
      }
      case 'PROFILE_CREATE': {
        const current = await this.requireState(mutation.sessionId, true);
        const mutationId = `profile-create:${current.session.id}`;
        const state = applyProfileCreate(current, mutation.input, mutationId);
        await this.store.save(state);
        this.cache.set(state.session.id, state);
        return {
          type: 'PROFILE_CREATE',
          profile: state.profileRecord!,
          state,
        };
      }
      case 'PROFILE_UPDATE': {
        const current = await this.requireState(mutation.sessionId, true);
        const mutationId = `profile-update:${current.profileRecord?.id ?? mutation.sessionId}`;
        const state = applyProfileUpdate(
          current,
          mutation.patch,
          mutation.expectedRevision,
          mutationId
        );
        await this.store.save(state);
        this.cache.set(state.session.id, state);
        return {
          type: 'PROFILE_UPDATE',
          profile: state.profileRecord!,
          state,
        };
      }
      case 'MODULE_EXECUTE': {
        const current = await this.requireState(mutation.sessionId, true);
        const state = applyModuleExecute({
          state: current,
          moduleId: mutation.moduleId,
          executionId: mutation.executionId,
          result: mutation.result,
          executedAt: mutation.executedAt,
          trace: mutation.trace,
          requestInput: mutation.requestInput,
          preferredLanguage: mutation.preferredLanguage,
          mutationId: mutation.executionId,
        });
        await this.store.save(state);
        this.cache.set(state.session.id, state);
        const profileActivated =
          state.profileRecord?.id !== current.profileRecord?.id ||
          state.profileRecord?.revision !== current.profileRecord?.revision;
        return {
          type: 'MODULE_EXECUTE',
          executionId: mutation.executionId,
          snapshotVersion: state.version.snapshotVersion,
          profileActivated,
          state,
        };
      }
      default: {
        const exhaustive: never = mutation;
        throw new Error(`Unknown mutation type: ${(exhaustive as SystemMutation).type}`);
      }
    }
  }

  private async requireState(sessionId: string, bypassCache = false): Promise<SystemState> {
    if (bypassCache) {
      this.cache.delete(sessionId);
    }

    const state = await this.getState(sessionId);
    if (!state) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return state;
  }
}

export const systemStateCoordinator = new SystemStateCoordinator();

export async function clearCoordinatorState(store?: PersistedSystemStateStore): Promise<void> {
  const target = store ?? getPersistedSystemStateStore();
  await target.clear();
  systemStateCoordinator.resetCache();
}
