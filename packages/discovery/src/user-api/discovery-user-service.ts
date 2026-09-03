import type { ProfileStore } from '../pipeline/profile-store.js';
import type { ResultStore } from '../pipeline/result-store.js';
import type { ResultStateWriter } from '../pipeline/result-state-writer.js';
import type { StrategyRegistry } from '../registry/strategy-registry.js';
import type { RunStore } from '../scheduler/run-store.js';
import type { Clock } from '../scheduler/clock.js';
import { clockIso, createSystemClock } from '../scheduler/clock.js';
import type { DiscoveryProfile } from '../types/profile.js';
import type { ResultState } from '../types/state.js';
import { ResultStateWriterError } from '../pipeline/result-state-writer.js';
import {
  DiscoveryUserConflictError,
  DiscoveryUserForbiddenError,
  DiscoveryUserNotFoundError,
  DiscoveryUserValidationError,
} from './errors.js';
import {
  assertStrategyExists,
  buildCreateProfileInput,
  buildUpdateProfileInput,
} from './profile-validation.js';
import { toDiscoveryResultUserView } from './result-view.js';
import type {
  CreateDiscoveryProfileInput,
  DiscoveryResultUserView,
  ProfileRunNowResult,
  ProfileRunSummary,
  UpdateDiscoveryProfileInput,
} from './types.js';
import type { DiscoveryService } from '../service/discovery-service.js';
import { executeProfileRunNow } from './profile-run.js';
import { syncProfileOperationalSchedule } from './schedule-projection.js';

export type DiscoveryUserServiceDeps = {
  profileStore: ProfileStore;
  resultStore: ResultStore;
  resultStateWriter: ResultStateWriter;
  runStore: RunStore;
  registry: StrategyRegistry;
  clock?: Clock;
  /** When set, enables runProfileNow (pull-driven enqueue + process). */
  discoveryService?: DiscoveryService;
};

export type DiscoveryUserService = {
  listProfiles(userId: string): Promise<DiscoveryProfile[]>;
  getProfile(userId: string, profileId: string): Promise<DiscoveryProfile>;
  createProfile(
    userId: string,
    input: CreateDiscoveryProfileInput
  ): Promise<DiscoveryProfile>;
  updateProfile(
    userId: string,
    profileId: string,
    input: UpdateDiscoveryProfileInput
  ): Promise<DiscoveryProfile>;
  enableProfile(userId: string, profileId: string): Promise<DiscoveryProfile>;
  disableProfile(userId: string, profileId: string): Promise<DiscoveryProfile>;
  listResults(userId: string, profileId: string): Promise<DiscoveryResultUserView[]>;
  getResult(
    userId: string,
    profileId: string,
    resultId: string
  ): Promise<DiscoveryResultUserView>;
  updateResultUserState(
    userId: string,
    profileId: string,
    resultId: string,
    userState: ResultState
  ): Promise<DiscoveryResultUserView>;
  getProfileRunSummary(userId: string, profileId: string): Promise<ProfileRunSummary>;
  runProfileNow(userId: string, profileId: string): Promise<ProfileRunNowResult>;
};

export function createDiscoveryUserService(
  deps: DiscoveryUserServiceDeps
): DiscoveryUserService {
  const clock = deps.clock ?? createSystemClock();

  async function requireOwnedProfile(
    userId: string,
    profileId: string
  ): Promise<DiscoveryProfile> {
    const profile = await deps.profileStore.get(profileId);
    if (!profile) {
      throw new DiscoveryUserNotFoundError(`Profile not found: ${profileId}`);
    }
    if (profile.userId !== userId) {
      throw new DiscoveryUserNotFoundError(`Profile not found: ${profileId}`);
    }
    return profile;
  }

  async function projectOperationalSchedule(profile: DiscoveryProfile): Promise<void> {
    if (!deps.discoveryService) {
      return;
    }
    await syncProfileOperationalSchedule({
      profile,
      discoveryService: deps.discoveryService,
      now: clockIso(clock),
    });
  }

  return {
    async listProfiles(userId) {
      return deps.profileStore.listByUserId(userId);
    },

    async getProfile(userId, profileId) {
      return requireOwnedProfile(userId, profileId);
    },

    async createProfile(userId, input) {
      assertStrategyExists(deps.registry, input.strategyId, input.strategyVersion);
      const existing = await deps.profileStore.get(input.id);
      if (existing) {
        throw new DiscoveryUserConflictError(
          `Profile already exists: ${input.id}`
        );
      }
      const now = clockIso(clock);
      const profile: DiscoveryProfile = {
        id: input.id,
        userId,
        name: input.name,
        strategyId: input.strategyId,
        strategyVersion: input.strategyVersion,
        criteria: structuredClone(input.criteria),
        schedule: structuredClone(input.schedule ?? { cadence: 'manual' }),
        notification: structuredClone(
          input.notification ?? { emailEnabled: true, skipEmptyDigest: true }
        ),
        enabled: input.enabled ?? true,
        createdAt: now,
        updatedAt: now,
      };
      await deps.profileStore.upsert(profile);
      await projectOperationalSchedule(profile);
      return structuredClone(profile);
    },

    async updateProfile(userId, profileId, input) {
      const existing = await requireOwnedProfile(userId, profileId);
      const patch = buildUpdateProfileInput(input, existing);
      const now = clockIso(clock);
      const updated: DiscoveryProfile = {
        ...existing,
        ...patch,
        criteria: patch.criteria
          ? structuredClone(patch.criteria)
          : existing.criteria,
        schedule: patch.schedule
          ? structuredClone(patch.schedule)
          : existing.schedule,
        notification: patch.notification
          ? structuredClone(patch.notification)
          : existing.notification,
        updatedAt: now,
      };
      await deps.profileStore.upsert(updated);
      await projectOperationalSchedule(updated);
      return structuredClone(updated);
    },

    async enableProfile(userId, profileId) {
      const existing = await requireOwnedProfile(userId, profileId);
      if (existing.enabled) {
        return structuredClone(existing);
      }
      const updated = {
        ...existing,
        enabled: true,
        updatedAt: clockIso(clock),
      };
      await deps.profileStore.upsert(updated);
      await projectOperationalSchedule(updated);
      return structuredClone(updated);
    },

    async disableProfile(userId, profileId) {
      const existing = await requireOwnedProfile(userId, profileId);
      if (!existing.enabled) {
        return structuredClone(existing);
      }
      const updated = {
        ...existing,
        enabled: false,
        updatedAt: clockIso(clock),
      };
      await deps.profileStore.upsert(updated);
      await projectOperationalSchedule(updated);
      return structuredClone(updated);
    },

    async listResults(userId, profileId) {
      await requireOwnedProfile(userId, profileId);
      const results = await deps.resultStore.listByProfile(profileId);
      return results.map(toDiscoveryResultUserView);
    },

    async getResult(userId, profileId, resultId) {
      await requireOwnedProfile(userId, profileId);
      const result = await deps.resultStore.getById(profileId, resultId);
      if (!result) {
        throw new DiscoveryUserNotFoundError(`Result not found: ${resultId}`);
      }
      return toDiscoveryResultUserView(result);
    },

    async updateResultUserState(userId, profileId, resultId, userState) {
      await requireOwnedProfile(userId, profileId);
      const at = clockIso(clock);
      try {
        const updated = await deps.resultStateWriter.transitionUserState({
          profileId,
          resultId,
          to: userState,
          actor: 'user',
          at,
        });
        return toDiscoveryResultUserView(updated);
      } catch (err) {
        if (err instanceof ResultStateWriterError) {
          if (err.message.includes('not found')) {
            throw new DiscoveryUserNotFoundError(err.message);
          }
          throw new DiscoveryUserValidationError(err.message);
        }
        throw err;
      }
    },

    async getProfileRunSummary(userId, profileId) {
      await requireOwnedProfile(userId, profileId);
      const runs = await deps.runStore.listByProfileId(profileId, 1);
      return {
        profileId,
        lastRun: runs[0] ?? null,
      };
    },

    async runProfileNow(userId, profileId) {
      const profile = await requireOwnedProfile(userId, profileId);
      if (!deps.discoveryService) {
        throw new DiscoveryUserValidationError('Discovery execution is not available');
      }
      if (!profile.enabled) {
        throw new DiscoveryUserValidationError('Profile is disabled');
      }
      return executeProfileRunNow({
        discoveryService: deps.discoveryService,
        profile,
      });
    },
  };
}

/** Parse and validate create input from an HTTP body. */
export function parseCreateProfileBody(
  body: unknown,
  registry: StrategyRegistry
): CreateDiscoveryProfileInput {
  try {
    return buildCreateProfileInput(body, registry);
  } catch (err) {
    if (err instanceof DiscoveryUserValidationError) throw err;
    throw new DiscoveryUserValidationError('Invalid profile create body');
  }
}

export function parseUpdateProfileBody(
  body: unknown,
  existing: DiscoveryProfile
): UpdateDiscoveryProfileInput {
  try {
    return buildUpdateProfileInput(body, existing);
  } catch (err) {
    if (err instanceof DiscoveryUserValidationError) throw err;
    throw new DiscoveryUserValidationError('Invalid profile update body');
  }
}

export {
  DiscoveryUserForbiddenError,
  DiscoveryUserNotFoundError,
  DiscoveryUserValidationError,
  DiscoveryUserConflictError,
};
