import type { DiscoveryCandidate } from '../types/candidate.js';
import type { DiscoveryResult, ResultPresentation } from '../types/result.js';
import type { NoveltyDecision, NoveltyPolicy, NoveltyStatus } from '../types/novelty.js';
import type { NotificationPreferences } from '../types/profile.js';
import type { ResultLifecycleStatus, ResultState } from '../types/state.js';

export type NoveltyDecisionInput = {
  existing: DiscoveryResult | null;
  candidate: DiscoveryCandidate;
  presentation: ResultPresentation;
  policy: NoveltyPolicy;
  notification: NotificationPreferences;
};

/**
 * Pure novelty / lifecycle / user-state / notification decision.
 * Does not mutate existing Result or candidate.
 */
export function decideNovelty(input: NoveltyDecisionInput): NoveltyDecision {
  const { existing, candidate, presentation, policy, notification } = input;

  if (!existing) {
    const shouldNotify = notification.emailEnabled !== false;
    return {
      novelty: 'NEW',
      lifecycle: 'ACTIVE',
      userState: 'NEW',
      shouldNotify,
      reason: shouldNotify ? 'NEW_OPPORTUNITY' : 'NEW_OPPORTUNITY_NOTIFY_DISABLED',
    };
  }

  // Expired / removed — never resurrect in E2.6
  if (
    existing.lifecycle === 'EXPIRED' ||
    existing.lifecycle === 'REMOVED' ||
    existing.userState === 'EXPIRED'
  ) {
    return {
      novelty: 'UNCHANGED',
      lifecycle: existing.lifecycle,
      userState: existing.userState === 'EXPIRED' ? 'EXPIRED' : existing.userState,
      shouldNotify: false,
      reason: 'EXPIRED_OR_REMOVED_NOT_RESURRECTED',
      existingResultId: existing.id,
    };
  }

  const material = detectMaterialChange({
    existing,
    candidate,
    presentation,
    policy,
  });

  const novelty: NoveltyStatus = material.changed ? 'UPDATED' : 'UNCHANGED';
  const lifecycle: ResultLifecycleStatus = material.changed
    ? 'UPDATED'
    : existing.lifecycle;

  // Preserve user intent — never DISMISSED → NEW
  const userState: ResultState = existing.userState;

  const shouldNotify = computeShouldNotify({
    novelty,
    userState,
    lifecycle,
    notification,
    notifyOnUpdate: policy.notifyOnMeaningfulUpdate,
  });

  return {
    novelty,
    lifecycle,
    userState,
    shouldNotify,
    reason: material.changed
      ? `MATERIAL_UPDATE:${material.fields.join(',')}`
      : 'NO_MATERIAL_CHANGE',
    existingResultId: existing.id,
  };
}

function computeShouldNotify(input: {
  novelty: NoveltyStatus;
  userState: ResultState;
  lifecycle: ResultLifecycleStatus;
  notification: NotificationPreferences;
  notifyOnUpdate: boolean;
}): boolean {
  if (input.notification.emailEnabled === false) return false;
  // Engine safety
  if (input.userState === 'DISMISSED') return false;
  if (input.userState === 'EXPIRED') return false;
  if (input.lifecycle === 'EXPIRED' || input.lifecycle === 'REMOVED') return false;
  if (input.novelty === 'UNCHANGED') return false;
  if (input.novelty === 'NEW') return true;
  // UPDATED
  return input.notifyOnUpdate === true;
}

export type MaterialChangeResult = {
  changed: boolean;
  fields: string[];
};

/**
 * MVP material-change definition (deterministic):
 * - strategy identity fingerprint fields (configured)
 * - optional presentation title/summary/primaryUrl
 * - optional verification.status
 * - optional score deltas ≥ threshold
 *
 * Never treats lastVerifiedAt / lastChangedAt / scoredAt / run ids as material.
 */
export function detectMaterialChange(input: {
  existing: DiscoveryResult;
  candidate: DiscoveryCandidate;
  presentation: ResultPresentation;
  policy: NoveltyPolicy;
}): MaterialChangeResult {
  const fields: string[] = [];
  const { existing, candidate, presentation, policy } = input;

  for (const key of policy.materialFingerprintFields) {
    const prev = existing.identity.fingerprintMaterial[key];
    const next = candidate.identity.fingerprintMaterial[key];
    if (normalizeComparable(prev) !== normalizeComparable(next)) {
      fields.push(`fingerprint.${key}`);
    }
  }

  if (policy.comparePresentation) {
    if (
      normalizeComparable(existing.canonicalPresentation.title) !==
      normalizeComparable(presentation.title)
    ) {
      fields.push('presentation.title');
    }
    if (
      normalizeComparable(existing.canonicalPresentation.summary ?? null) !==
      normalizeComparable(presentation.summary ?? null)
    ) {
      fields.push('presentation.summary');
    }
    if (
      normalizeComparable(existing.canonicalPresentation.primaryUrl ?? null) !==
      normalizeComparable(presentation.primaryUrl ?? null)
    ) {
      fields.push('presentation.primaryUrl');
    }
  }

  if (policy.compareVerificationStatus && candidate.verification) {
    if (existing.verification.status !== candidate.verification.status) {
      fields.push('verification.status');
    }
  }

  const threshold = policy.scoreDeltaThreshold;
  if (threshold !== undefined && candidate.score) {
    if (Math.abs(existing.score.matchScore - candidate.score.matchScore) >= threshold) {
      fields.push('score.matchScore');
    }
    if (
      Math.abs(existing.score.confidenceScore - candidate.score.confidenceScore) >=
      threshold
    ) {
      fields.push('score.confidenceScore');
    }
  }

  return { changed: fields.length > 0, fields };
}

function normalizeComparable(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

/** Build presentation snapshot from scored candidate (not persistence). */
export function presentationFromCandidate(
  candidate: DiscoveryCandidate
): ResultPresentation {
  const title =
    typeof candidate.extracted.fields.title === 'string'
      ? candidate.extracted.fields.title
      : typeof candidate.identity.fingerprintMaterial.title === 'string'
        ? String(candidate.identity.fingerprintMaterial.title)
        : candidate.id;
  const summary =
    typeof candidate.extracted.fields.snippet === 'string'
      ? candidate.extracted.fields.snippet
      : undefined;
  return {
    title,
    summary,
    primaryUrl: candidate.identity.canonicalUrl,
  };
}
