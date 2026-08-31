import type { DiscoveryCandidate } from '../types/candidate.js';
import type { Score } from '../types/score.js';
import type { DiscoveryStrategyDescriptor } from '../types/strategy.js';
import type { VerificationResult } from '../types/verification.js';
import type { EnginePolicy } from '../engine-policy.js';
import { DEFAULT_ENGINE_POLICY } from '../engine-policy.js';
import type { NoveltyDecision } from '../types/novelty.js';
import { validateEvidenceList } from './evidence.js';
import { validateScore } from './score.js';

export type PromotionInput = {
  candidate: DiscoveryCandidate;
  verification: VerificationResult | null | undefined;
  score: Score | null | undefined;
  strategy: DiscoveryStrategyDescriptor;
  enginePolicy?: EnginePolicy;
  /** When set, must match strategy.id / strategy.version */
  expectedStrategyId?: string;
  expectedStrategyVersion?: string;
  /**
   * Persistence-ready checks (E2.7): novelty, evidence attribution, score shape, identity.
   * Opt-in so E1 notify-threshold tests stay unchanged.
   */
  forPersistence?: boolean;
  noveltyDecision?: NoveltyDecision | null;
};

export type PromotionDenialReason =
  | 'REJECTED_CANDIDATE'
  | 'FILTER_NOT_PASSED'
  | 'MISSING_VERIFICATION'
  | 'VERIFICATION_FAIL'
  | 'VERIFICATION_UNKNOWN'
  | 'OFFICIAL_SOURCE_REQUIRED'
  | 'REQUIRED_CHECK_NOT_TRUE'
  | 'MISSING_SCORE'
  | 'INVALID_SCORE'
  | 'LOW_MATCH'
  | 'LOW_CONFIDENCE'
  | 'MISSING_EVIDENCE'
  | 'INVALID_EVIDENCE'
  | 'INVALID_IDENTITY'
  | 'STRATEGY_MISMATCH'
  | 'MISSING_NOVELTY';

export type PromotionDecision =
  | { eligible: true }
  | { eligible: false; reasons: PromotionDenialReason[] };

/**
 * Pure promotion eligibility — no I/O, no persistence.
 * Strategies cannot weaken EnginePolicy; required UNKNOWN never passes.
 */
export function canPromote(input: PromotionInput): PromotionDecision {
  const policy = input.enginePolicy ?? DEFAULT_ENGINE_POLICY;
  const reasons: PromotionDenialReason[] = [];

  if (input.candidate.rejection || input.candidate.stage === 'REJECTED') {
    reasons.push('REJECTED_CANDIDATE');
  }

  if (!input.candidate.deterministicFilterPassed) {
    reasons.push('FILTER_NOT_PASSED');
  }

  if (
    input.expectedStrategyId !== undefined &&
    input.expectedStrategyId !== input.strategy.id
  ) {
    reasons.push('STRATEGY_MISMATCH');
  }
  if (
    input.expectedStrategyVersion !== undefined &&
    input.expectedStrategyVersion !== input.strategy.version
  ) {
    reasons.push('STRATEGY_MISMATCH');
  }

  const verification = input.verification;
  const vp = input.strategy.verificationPolicy;

  if (policy.enforceFoundNotVerified && vp.requireVerificationPass) {
    if (!verification) {
      reasons.push('MISSING_VERIFICATION');
    } else if (verification.status === 'FAIL') {
      reasons.push('VERIFICATION_FAIL');
    } else if (verification.status === 'UNKNOWN') {
      reasons.push('VERIFICATION_UNKNOWN');
    } else if (verification.status !== 'PASS') {
      reasons.push('VERIFICATION_UNKNOWN');
    } else {
      const required = verification.checks.filter((c) => c.required);
      if (required.some((c) => c.outcome !== 'TRUE')) {
        reasons.push('REQUIRED_CHECK_NOT_TRUE');
      }
    }

    if (vp.requireOfficialSource && verification) {
      const official = verification.checks.find((c) => c.id === 'official_source');
      if (official) {
        if (official.outcome !== 'TRUE') {
          reasons.push('OFFICIAL_SOURCE_REQUIRED');
        }
      } else if (verification.sourceTrust !== 'OFFICIAL') {
        reasons.push('OFFICIAL_SOURCE_REQUIRED');
      }
    }
  }

  const score = input.score;
  if (!score) {
    reasons.push('MISSING_SCORE');
  } else {
    if (score.matchScore < input.strategy.scoringPolicy.minMatchToNotify) {
      reasons.push('LOW_MATCH');
    }
    if (score.confidenceScore < input.strategy.scoringPolicy.minConfidenceToNotify) {
      reasons.push('LOW_CONFIDENCE');
    }
  }

  if (input.forPersistence) {
    if (!input.noveltyDecision) {
      reasons.push('MISSING_NOVELTY');
    }

    if (!hasValidIdentity(input.candidate)) {
      reasons.push('INVALID_IDENTITY');
    }

    if (score) {
      const scoreCheck = validateScore({
        score,
        policyDimensions: input.strategy.scoringPolicy.dimensions,
        expectedStrategyVersion: input.strategy.version,
      });
      if (!scoreCheck.ok) {
        reasons.push('INVALID_SCORE');
      }
    }

    if (verification) {
      const evidence = input.candidate.evidence ?? [];
      if (verification.evidenceIds.length > 0 && evidence.length === 0) {
        reasons.push('MISSING_EVIDENCE');
      } else if (verification.evidenceIds.length > 0) {
        const known = new Set(evidence.map((e) => e.id));
        for (const id of verification.evidenceIds) {
          if (!known.has(id)) {
            reasons.push('INVALID_EVIDENCE');
            break;
          }
        }
        const validated = validateEvidenceList(evidence);
        if (!validated.ok) {
          reasons.push('INVALID_EVIDENCE');
        }
      } else if (vp.requireOfficialSource) {
        // Official source strategies must carry attributable evidence on promote
        if (evidence.length === 0) {
          reasons.push('MISSING_EVIDENCE');
        } else {
          const validated = validateEvidenceList(evidence);
          if (!validated.ok) {
            reasons.push('INVALID_EVIDENCE');
          }
        }
      }
    }
  }

  if (reasons.length > 0) {
    return { eligible: false, reasons: [...new Set(reasons)] };
  }

  return { eligible: true };
}

function hasValidIdentity(candidate: DiscoveryCandidate): boolean {
  const { identity } = candidate;
  if (!identity) return false;
  const hasExternal = Object.keys(identity.externalIds ?? {}).length > 0;
  const hasFp = Object.keys(identity.fingerprintMaterial ?? {}).some(
    (k) =>
      identity.fingerprintMaterial[k] !== null &&
      identity.fingerprintMaterial[k] !== undefined &&
      String(identity.fingerprintMaterial[k]).trim() !== ''
  );
  const hasUrl = Boolean(identity.canonicalUrl?.trim());
  return hasExternal || hasFp || hasUrl;
}
