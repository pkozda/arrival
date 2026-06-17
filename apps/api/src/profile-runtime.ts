import { ProfileEngine, ProfileNotFoundError, type ProfileStore } from '@arrivalos/profile';
import type {
  CreateProfileMeta,
  ProfileRecord,
  ProfileRevision,
  UpdateProfileMeta,
} from '@arrivalos/profile';
import type { ProfileDocument, ProfilePatch } from '@arrivalos/profile';
import { systemStateCoordinator } from './state/system-state-coordinator.js';

class CoordinatorBackedProfileStore implements ProfileStore {
  async create(_document: ProfileDocument, _meta?: CreateProfileMeta): Promise<ProfileRecord> {
    throw new Error('Profile writes must go through SystemStateCoordinator');
  }

  async get(profileId: string): Promise<ProfileRecord | null> {
    void profileId;
    return null;
  }

  async update(
    _profileId: string,
    _patch: ProfilePatch,
    _expectedRevision: number,
    _meta?: UpdateProfileMeta
  ): Promise<ProfileRecord> {
    throw new Error('Profile writes must go through SystemStateCoordinator');
  }

  async delete(_profileId: string): Promise<void> {
    throw new Error('Profile writes must go through SystemStateCoordinator');
  }

  async listRevisions(profileId: string): Promise<ProfileRevision[]> {
    void profileId;
    throw new ProfileNotFoundError(profileId);
  }

  async bindSession(_sessionId: string, _profileId: string): Promise<void> {
    throw new Error('Profile writes must go through SystemStateCoordinator');
  }

  async getBySession(sessionId: string): Promise<ProfileRecord | null> {
    const state = await systemStateCoordinator.getState(sessionId);
    return state?.profileRecord ?? null;
  }
}

export const profileStore = new CoordinatorBackedProfileStore();
export const profileEngine = new ProfileEngine(profileStore);
