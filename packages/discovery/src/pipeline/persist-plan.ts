import type { DiscoveryCandidate } from '../types/candidate.js';
import type { DiscoveryResult, ResultPresentation } from '../types/result.js';
import type { NoveltyDecision } from '../types/novelty.js';
import type { Evidence } from '../types/evidence.js';
import { resultIdentityKey } from './result-store.js';
import { presentationFromCandidate } from './novelty-decision.js';

export type PersistPromotionBuildInput = {
  candidate: DiscoveryCandidate;
  existing: DiscoveryResult | null;
  novelty: NoveltyDecision;
  profileId: string;
  strategyId: string;
  strategyVersion: string;
  identityFingerprintFields: readonly string[];
  materialExtractedFields?: readonly string[];
  now: string;
};

export type PersistPromotionPlan =
  | { action: 'CREATE'; result: DiscoveryResult }
  | { action: 'UPDATE'; result: DiscoveryResult }
  | { action: 'SKIP_UNCHANGED'; result: DiscoveryResult };

/**
 * Build immutable create/update/skip plan from novelty + candidate.
 * Does not perform I/O.
 */
export function buildPersistPlan(
  input: PersistPromotionBuildInput
): PersistPromotionPlan {
  const presentation = presentationFromCandidate(input.candidate);
  const verification = input.candidate.verification!;
  const score = input.candidate.score!;
  const evidence = mergeEvidence(
    input.existing?.evidence ?? [],
    input.candidate.evidence ?? []
  );

  if (!input.existing || input.novelty.novelty === 'NEW') {
    const id = `result:${input.profileId}:${resultIdentityKey(
      input.candidate.identity,
      input.identityFingerprintFields
    )}`;
    const result: DiscoveryResult = {
      id,
      profileId: input.profileId,
      strategyId: input.strategyId,
      strategyVersion: input.strategyVersion,
      identity: cloneIdentity(input.candidate.identity),
      canonicalPresentation: clonePresentation(presentation),
      source: { ...input.candidate.source },
      verification: cloneVerification(verification),
      evidence,
      score: cloneScore(score),
      lifecycle: 'ACTIVE',
      userState: 'NEW',
      firstSeenAt: input.now,
      lastVerifiedAt: verification.verifiedAt,
      lastChangedAt: input.now,
      promotedFromCandidateId: input.candidate.id,
      promotedFromRunId: input.candidate.runId,
      materialFields: snapshotMaterialFields(
        input.candidate,
        input.materialExtractedFields
      ),
    };
    return { action: 'CREATE', result };
  }

  if (input.novelty.novelty === 'UNCHANGED') {
    // Return clone of existing — no timestamp churn
    return {
      action: 'SKIP_UNCHANGED',
      result: structuredClone(input.existing),
    };
  }

  // UPDATED — preserve userState from novelty decision (may be DISMISSED)
  const result: DiscoveryResult = {
    ...structuredClone(input.existing),
    identity: cloneIdentity(input.candidate.identity),
    canonicalPresentation: clonePresentation(presentation),
    source: { ...input.candidate.source },
    verification: cloneVerification(verification),
    evidence,
    score: cloneScore(score),
    lifecycle: 'UPDATED',
    userState: input.novelty.userState,
    lastVerifiedAt: verification.verifiedAt,
    lastChangedAt: input.now,
    // firstSeenAt preserved
    strategyId: input.strategyId,
    strategyVersion: input.strategyVersion,
    promotedFromCandidateId: input.candidate.id,
    promotedFromRunId: input.candidate.runId,
    materialFields: snapshotMaterialFields(
      input.candidate,
      input.materialExtractedFields
    ),
  };
  return { action: 'UPDATE', result };
}

function snapshotMaterialFields(
  candidate: DiscoveryCandidate,
  keys: readonly string[] | undefined
): Record<string, string | number | boolean | null> | undefined {
  if (!keys || keys.length === 0) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  for (const key of keys) {
    const value = candidate.extracted.fields[key];
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function mergeEvidence(
  previous: Evidence[],
  next: Evidence[]
): Evidence[] {
  const byId = new Map<string, Evidence>();
  for (const e of previous) {
    byId.set(e.id, { ...e });
  }
  for (const e of next) {
    byId.set(e.id, { ...e });
  }
  return [...byId.values()];
}

function cloneIdentity(identity: DiscoveryCandidate['identity']) {
  return {
    externalIds: { ...identity.externalIds },
    canonicalUrl: identity.canonicalUrl,
    fingerprintMaterial: { ...identity.fingerprintMaterial },
  };
}

function clonePresentation(p: ResultPresentation): ResultPresentation {
  return {
    title: p.title,
    summary: p.summary,
    primaryUrl: p.primaryUrl,
  };
}

function cloneVerification(v: NonNullable<DiscoveryCandidate['verification']>) {
  return {
    ...v,
    checks: v.checks.map((c) => ({ ...c })),
    evidenceIds: [...v.evidenceIds],
  };
}

function cloneScore(score: NonNullable<DiscoveryCandidate['score']>) {
  return {
    ...score,
    breakdown: {
      dimensions: score.breakdown.dimensions.map((d) => ({ ...d })),
    },
  };
}
