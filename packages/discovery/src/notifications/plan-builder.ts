import type { DiscoveryDigest } from '../types/digest.js';
import type {
  NotificationChannel,
  NotificationPayload,
  NotificationPlan,
  NotificationPriority,
  NotificationRecipient,
} from './types.js';

export type BuildNotificationPlanInput = {
  digest: DiscoveryDigest;
  recipient: NotificationRecipient;
  channel: NotificationChannel;
};

/**
 * Builds a provider-neutral notification plan from an authoritative digest.
 * Does not recompute novelty, scoring, verification, or promotion eligibility.
 */
export function buildNotificationPlan(
  input: BuildNotificationPlanInput
): NotificationPlan | null {
  const { digest, recipient, channel } = input;
  if (digest.entries.length === 0) return null;

  const payload = buildNotificationPayload(digest);

  return {
    digestId: digest.id,
    profileId: digest.profileId,
    runId: digest.runId,
    channel,
    recipient,
    payload,
  };
}

export function buildNotificationPayload(digest: DiscoveryDigest): NotificationPayload {
  const items = digest.entries.map((entry) => ({
    resultId: entry.resultId,
    rank: entry.rank,
    rankValue: entry.rankValue,
    novelty: entry.novelty,
    priority: derivePriority(entry.rank),
  }));

  return {
    title: buildTitle(digest),
    summary: buildSummaryText(digest),
    resultIds: [...digest.resultIds],
    items,
    runId: digest.runId,
    strategyId: digest.strategyId,
    strategyVersion: digest.strategyVersion,
    period: { ...digest.period },
  };
}

function derivePriority(rank: number): NotificationPriority {
  if (rank === 1) return 'HIGH';
  if (rank <= 3) return 'NORMAL';
  return 'LOW';
}

function buildTitle(digest: DiscoveryDigest): string {
  const { newResults, updatedResults, totalResults } = digest.summary;
  if (newResults > 0 && updatedResults > 0) {
    return `${newResults} new and ${updatedResults} updated opportunities`;
  }
  if (newResults > 0) {
    return newResults === 1 ? '1 new opportunity' : `${newResults} new opportunities`;
  }
  if (updatedResults > 0) {
    return updatedResults === 1 ? '1 updated opportunity' : `${updatedResults} updated opportunities`;
  }
  return totalResults === 1 ? '1 discovery update' : `${totalResults} discovery updates`;
}

function buildSummaryText(digest: DiscoveryDigest): string {
  const { totalResults, newResults, updatedResults } = digest.summary;
  return `Discovery run completed with ${totalResults} notable result(s): ${newResults} new, ${updatedResults} updated.`;
}
