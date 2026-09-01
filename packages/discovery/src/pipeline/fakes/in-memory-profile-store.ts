import type { DiscoveryProfile } from '../../types/profile.js';
import type { ProfileStore } from '../profile-store.js';

export function createInMemoryProfileStore(
  profiles: DiscoveryProfile[] = []
): ProfileStore {
  const byId = new Map<string, DiscoveryProfile>();
  for (const profile of profiles) {
    byId.set(profile.id, structuredClone(profile));
  }

  return {
    async get(profileId) {
      const found = byId.get(profileId);
      return found ? structuredClone(found) : null;
    },
    async upsert(profile) {
      byId.set(profile.id, structuredClone(profile));
    },
    async listByUserId(userId) {
      return [...byId.values()]
        .filter((p) => p.userId === userId)
        .map((p) => structuredClone(p));
    },
  };
}
