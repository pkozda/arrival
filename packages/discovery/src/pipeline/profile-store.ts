import type { DiscoveryProfile } from '../types/profile.js';

/** Port for loading profiles — E2.1 uses in-memory fakes; no DB in domain. */
export interface ProfileStore {
  get(profileId: string): Promise<DiscoveryProfile | null>;
}

export class ProfileStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileStoreError';
  }
}
