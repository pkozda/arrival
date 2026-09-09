import type { DiscoveryProfile } from '../types/profile.js';
import type { ProfileStore } from '../pipeline/profile-store.js';

export type DiscoveryOwnershipTransferResult = {
  fromUserId: string;
  toUserId: string;
  transferredProfileIds: string[];
};

/**
 * Transfer Discovery profiles from a session-scoped owner to an account owner.
 *
 * Idempotent: when `fromUserId` owns nothing, returns an empty transfer list.
 * Secure: only profiles whose `userId === fromUserId` are rewritten.
 * Preserves profile ids (runs/results/schedules remain linked).
 */
export async function transferDiscoveryProfileOwnership(input: {
  profileStore: ProfileStore;
  fromUserId: string;
  toUserId: string;
  now?: string;
}): Promise<DiscoveryOwnershipTransferResult> {
  const { profileStore, fromUserId, toUserId } = input;
  if (!fromUserId || !toUserId) {
    throw new Error('fromUserId and toUserId are required');
  }
  if (fromUserId === toUserId) {
    return {
      fromUserId,
      toUserId,
      transferredProfileIds: [],
    };
  }

  const now = input.now ?? new Date().toISOString();
  const sessionProfiles = await profileStore.listByUserId(fromUserId);
  const transferredProfileIds: string[] = [];

  for (const profile of sessionProfiles) {
    if (profile.userId !== fromUserId) {
      continue;
    }
    const updated: DiscoveryProfile = {
      ...profile,
      userId: toUserId,
      updatedAt: now,
    };
    await profileStore.upsert(updated);
    transferredProfileIds.push(profile.id);
  }

  return {
    fromUserId,
    toUserId,
    transferredProfileIds,
  };
}
