import {
  transferDiscoveryProfileOwnership,
  type DiscoveryOwnershipTransferResult,
} from '@arrival-atlas/discovery';
import { getDiscoveryPersistence } from './discovery-user-runtime.js';
import { getDiscoveryUserNotificationEmailStore } from './user-notification-email-runtime.js';

export type DiscoveryContinuityMigrationResult = DiscoveryOwnershipTransferResult & {
  notificationEmailTransferred: boolean;
};

/**
 * PD-011: migrate session-owned Discovery state onto the trusted account owner.
 * Caller must pass server-derived sessionId/accountId only.
 */
export async function migrateDiscoverySessionToAccount(input: {
  sessionId: string;
  accountId: string;
  now?: string;
}): Promise<DiscoveryContinuityMigrationResult> {
  const { sessionId, accountId } = input;
  if (!sessionId || !accountId) {
    throw new Error('sessionId and accountId are required for Discovery migration');
  }

  const { profileStore } = getDiscoveryPersistence();
  const transfer = await transferDiscoveryProfileOwnership({
    profileStore,
    fromUserId: sessionId,
    toUserId: accountId,
    now: input.now,
  });

  const emailStore = getDiscoveryUserNotificationEmailStore();
  const sessionEmail = emailStore.getUserNotificationEmail(sessionId);
  const accountEmail = emailStore.getUserNotificationEmail(accountId);
  let notificationEmailTransferred = false;
  if (sessionEmail && !accountEmail) {
    emailStore.setUserNotificationEmail(accountId, sessionEmail);
    emailStore.clearUserNotificationEmail(sessionId);
    notificationEmailTransferred = true;
  }

  return {
    ...transfer,
    notificationEmailTransferred,
  };
}

/**
 * Heal path: when the request already has an account, migrate any leftover
 * session-owned Discovery profiles for this session (idempotent).
 */
export async function maybeHealDiscoveryOwnership(identity: {
  sessionId: string;
  accountId: string | null;
}): Promise<DiscoveryContinuityMigrationResult | null> {
  if (!identity.accountId) {
    return null;
  }
  return migrateDiscoverySessionToAccount({
    sessionId: identity.sessionId,
    accountId: identity.accountId,
  });
}
