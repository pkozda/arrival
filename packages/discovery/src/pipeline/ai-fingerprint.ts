import { createHash } from 'node:crypto';
import type { AiEvaluationTask } from '../types/ai-evaluation.js';
import type { CandidateIdentity, ExtractedFacts } from '../types/candidate.js';
import type { DiscoveryCriteria } from '../types/criteria.js';
import type { RejectionReasonCode } from '../types/rejection.js';
import type { VerificationResult } from '../types/verification.js';
import { stableJsonStringify } from './ai-cost.js';

/**
 * Inputs that define whether two AI evaluations are interchangeable.
 * Excludes runId, jobId, timestamps, and random IDs.
 */
export type AiEvaluationFingerprintInput = {
  strategyId: string;
  strategyVersion: string;
  identity: CandidateIdentity;
  criteria: DiscoveryCriteria;
  verification: Pick<
    VerificationResult,
    'status' | 'sourceTrust' | 'freshness' | 'checks' | 'evidenceIds'
  >;
  allowedTasks: readonly AiEvaluationTask[];
  rejectOn: readonly RejectionReasonCode[];
  extracted: ExtractedFacts;
  evidenceIds: readonly string[];
};

/**
 * Deterministic AI evaluation fingerprint (sha256 of stable JSON material).
 */
export function computeAiEvaluationFingerprint(
  input: AiEvaluationFingerprintInput
): string {
  const material = {
    strategyId: input.strategyId,
    strategyVersion: input.strategyVersion,
    identity: {
      canonicalUrl: input.identity.canonicalUrl ?? null,
      externalIds: input.identity.externalIds,
      fingerprintMaterial: input.identity.fingerprintMaterial,
    },
    criteria: {
      required: input.criteria.required.map((c) => ({
        key: c.key,
        value: c.value,
      })),
      preferred: input.criteria.preferred.map((c) => ({
        key: c.key,
        value: c.value,
      })),
      excluded: input.criteria.excluded.map((c) => ({
        key: c.key,
        value: c.value,
      })),
      flexible: input.criteria.flexible.map((c) => ({
        key: c.key,
        value: c.value,
      })),
    },
    verification: {
      status: input.verification.status,
      sourceTrust: input.verification.sourceTrust,
      freshness: input.verification.freshness,
      checks: input.verification.checks.map((c) => ({
        id: c.id,
        outcome: c.outcome,
        required: c.required,
      })),
      evidenceIds: [...input.verification.evidenceIds].sort(),
    },
    allowedTasks: [...input.allowedTasks].sort(),
    rejectOn: [...input.rejectOn].sort(),
    extractedFields: input.extracted.fields,
    evidenceIds: [...input.evidenceIds].sort(),
  };

  return createHash('sha256')
    .update(stableJsonStringify(material), 'utf8')
    .digest('hex');
}

/**
 * Structured payload used for estimated input-token accounting.
 * Mirrors AI-relevant request material (not provider envelopes / secrets).
 */
export function buildAiAccountingPayload(input: {
  allowedTasks: readonly AiEvaluationTask[];
  rejectOn: readonly RejectionReasonCode[];
  identity: CandidateIdentity;
  verification: Pick<
    VerificationResult,
    'status' | 'sourceTrust' | 'freshness' | 'checks'
  >;
  evidence: ReadonlyArray<{ id: string; type: string; statement: string }>;
  criteria: DiscoveryCriteria;
  extracted: ExtractedFacts;
}): unknown {
  return {
    allowedTasks: input.allowedTasks,
    rejectOn: input.rejectOn,
    identity: {
      canonicalUrl: input.identity.canonicalUrl ?? null,
      fingerprintMaterial: input.identity.fingerprintMaterial,
    },
    verification: {
      status: input.verification.status,
      sourceTrust: input.verification.sourceTrust,
      freshness: input.verification.freshness,
      checks: input.verification.checks.map((c) => ({
        id: c.id,
        outcome: c.outcome,
        required: c.required,
      })),
    },
    evidence: input.evidence.map((e) => ({
      id: e.id,
      type: e.type,
      statement: e.statement,
    })),
    criteria: input.criteria,
    untrustedExtractedContent: {
      warning: 'UNTRUSTED',
      fields: input.extracted.fields,
    },
  };
}
