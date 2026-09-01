import type { DiscoveryProfile } from '../types/profile.js';

/** Port for profile persistence — E7.1 adds durable SQLite adapter. */
export interface ProfileStore {
  get(profileId: string): Promise<DiscoveryProfile | null>;
  upsert(profile: DiscoveryProfile): Promise<void>;
  /** List profiles owned by a user (E9.1 user API). */
  listByUserId(userId: string): Promise<DiscoveryProfile[]>;
}

export class ProfileStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileStoreError';
  }
}
