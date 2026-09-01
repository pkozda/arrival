import type { DiscoveryProfile } from '../types/profile.js';

/** Port for profile persistence — E7.1 adds durable SQLite adapter. */
export interface ProfileStore {
  get(profileId: string): Promise<DiscoveryProfile | null>;
  upsert(profile: DiscoveryProfile): Promise<void>;
}

export class ProfileStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileStoreError';
  }
}
