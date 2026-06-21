import type { ExecutionTrace } from '@arrival-atlas/profile';
import {
  getPersistedSystemStateStore,
  type PersistedSystemStateStore,
} from './persisted-system-state-store.js';
import { attachMutationActor, type MutationActor } from './mutation-actor.js';
import {
  applyAccountClaim,
  applyAccountLink,
  applyEconomicRealityEventAppend,
  applyModuleExecute,
  applyProfileCreate,
  applyProfileUpdate,
  applySessionPatch,
  createInitialSystemState,
  getLatestExecutionTrace,
} from './system-state-apply.js';
import { commitProfileMutationRequest } from './apply-profile-mutation.js';
import { ProfileMutationCommitError } from './profile-mutation-errors.js';
import { finalizeSystemState } from './system-state-hash.js';
import type { SystemState } from './system-state-types.js';
import type {
  AccountClaimMutation,
  AccountLinkMutation,
  EconomicRealityEventAppendMutation,
  ModuleExecuteMutation,
  ProfileCreateMutation,
  ProfileMutationApplyMutation,
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
type ProfileMutationApplyResult = Extract<SystemMutationResult, { type: 'PROFILE_MUTATION_APPLY' }>;
type ModuleExecuteResult = Extract<SystemMutationResult, { type: 'MODULE_EXECUTE' }>;
type AccountClaimResult = Extract<SystemMutationResult, { type: 'ACCOUNT_CLAIM' }>;
type AccountLinkResult = Extract<SystemMutationResult, { type: 'ACCOUNT_LINK' }>;
type EconomicRealityEventAppendResult = Extract<
  SystemMutationResult,
  { type: 'ECONOMIC_REALITY_EVENT_APPEND' }
>;

export class SystemStateCoordinator {
  private readonly cache = new Map<string, SystemState>();
  private readonly mutationChains = new Map<string, Promise<unknown>>();
  private readonly storeResolver: () => PersistedSystemStateStore;

  constructor(storeResolver: () => PersistedSystemStateStore = getPersistedSystemStateStore) {
    this.storeResolver = storeResolver;
  }

  private get store(): PersistedSystemStateStore {
    return this.storeResolver();
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
  async applyMutation(mutation: ProfileMutationApplyMutation): Promise<ProfileMutationApplyResult>;
  async applyMutation(mutation: ModuleExecuteMutation): Promise<ModuleExecuteResult>;
  async applyMutation(mutation: AccountClaimMutation): Promise<AccountClaimResult>;
  async applyMutation(mutation: AccountLinkMutation): Promise<AccountLinkResult>;
  async applyMutation(
    mutation: EconomicRealityEventAppendMutation
  ): Promise<EconomicRealityEventAppendResult>;
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

  private async persistState(
    state: SystemState,
    actor?: MutationActor
  ): Promise<SystemState> {
    const enriched = attachMutationActor(state, actor);
    await this.store.save(enriched);
    this.cache.set(enriched.session.id, enriched);
    return enriched;
  }

  private getMutationActor(mutation: SystemMutation): MutationActor | undefined {
    return 'actor' in mutation ? mutation.actor : undefined;
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
        const enriched = await this.persistState(state, this.getMutationActor(mutation));
        return { type: 'SESSION_CREATE', state: enriched };
      }
      case 'SESSION_PATCH': {
        const current = await this.requireState(mutation.sessionId, true);
        const state = applySessionPatch(current, mutation.context, mutation.mutationId);
        const enriched = await this.persistState(state, this.getMutationActor(mutation));
        return { type: 'SESSION_PATCH', state: enriched };
      }
      case 'PROFILE_CREATE': {
        const current = await this.requireState(mutation.sessionId, true);
        const mutationId = `profile-create:${current.session.id}`;
        const state = applyProfileCreate(current, mutation.input, mutationId);
        const enriched = await this.persistState(state, this.getMutationActor(mutation));
        return {
          type: 'PROFILE_CREATE',
          profile: enriched.profileRecord!,
          state: enriched,
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
        const enriched = await this.persistState(state, this.getMutationActor(mutation));
        return {
          type: 'PROFILE_UPDATE',
          profile: enriched.profileRecord!,
          state: enriched,
        };
      }
      case 'PROFILE_MUTATION_APPLY': {
        const current = await this.requireState(mutation.sessionId, true);
        const committed = commitProfileMutationRequest(current, mutation.request);
        if (!committed.result.ok) {
          throw new ProfileMutationCommitError(
            committed.result.code,
            committed.result.message,
            committed.result.issues
          );
        }

        const state = finalizeSystemState(committed.state, mutation.request.requestId);
        const enriched = await this.persistState(state, this.getMutationActor(mutation));
        return {
          type: 'PROFILE_MUTATION_APPLY',
          eventId: committed.result.eventId,
          revision: committed.result.revision,
          userContext: enriched.userContext ?? { profile: null },
          state: enriched,
        };
      }
      case 'MODULE_EXECUTE': {
        const current = await this.requireState(mutation.sessionId, true);
        const state = applyModuleExecute({
          state: current,
          moduleId: mutation.moduleId,
          executionId: mutation.executionId,
          result: mutation.result,
          moduleResult: mutation.moduleResult,
          projection: mutation.projection,
          executedAt: mutation.executedAt,
          trace: mutation.trace,
          requestInput: mutation.requestInput,
          preferredLanguage: mutation.preferredLanguage,
          mutationId: mutation.executionId,
        });
        const enriched = await this.persistState(state, this.getMutationActor(mutation));
        const profileActivated =
          enriched.profileRecord?.id !== current.profileRecord?.id ||
          enriched.profileRecord?.revision !== current.profileRecord?.revision;
        return {
          type: 'MODULE_EXECUTE',
          executionId: mutation.executionId,
          snapshotVersion: enriched.version.snapshotVersion,
          profileActivated,
          state: enriched,
        };
      }
      case 'ACCOUNT_CLAIM': {
        const current = await this.requireState(mutation.sessionId, true);
        const state = applyAccountClaim(current, mutation.accountId, mutation.mutationId);
        const enriched = await this.persistState(state, this.getMutationActor(mutation));
        return {
          type: 'ACCOUNT_CLAIM',
          accountId: enriched.accountId!,
          state: enriched,
        };
      }
      case 'ACCOUNT_LINK': {
        const current = await this.requireState(mutation.sessionId, true);
        const state = applyAccountLink(current, mutation.accountId, mutation.mutationId);
        const enriched = await this.persistState(state, this.getMutationActor(mutation));
        return {
          type: 'ACCOUNT_LINK',
          accountId: enriched.accountId!,
          state: enriched,
        };
      }
      case 'ECONOMIC_REALITY_EVENT_APPEND': {
        const current = await this.requireState(mutation.sessionId, true);
        const mutationId = `economic-reality-event:${mutation.event.timestamp}:${mutation.event.type}`;
        const state = applyEconomicRealityEventAppend(current, mutation.event, mutationId);
        const enriched = await this.persistState(state, this.getMutationActor(mutation));
        return {
          type: 'ECONOMIC_REALITY_EVENT_APPEND',
          event: mutation.event,
          state: enriched,
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
