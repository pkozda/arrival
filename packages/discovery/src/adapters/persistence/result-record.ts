import type { DiscoveryResult } from '../../types/result.js';
import type { Evidence } from '../../types/evidence.js';
import { ResultStoreError } from '../../pipeline/result-store.js';

/** Current persisted record schema — bump when breaking serialization changes. */
export const DISCOVERY_RESULT_RECORD_SCHEMA_VERSION = 1 as const;

export type DiscoveryResultRecordV1 = {
  schemaVersion: typeof DISCOVERY_RESULT_RECORD_SCHEMA_VERSION;
  result: DiscoveryResult;
};

/**
 * Deterministic JSON envelope for durable storage.
 * Provider-neutral — no SQL/ORM types leak to domain.
 */
export function serializeDiscoveryResult(result: DiscoveryResult): string {
  const record: DiscoveryResultRecordV1 = {
    schemaVersion: DISCOVERY_RESULT_RECORD_SCHEMA_VERSION,
    result: structuredClone(result),
  };
  return JSON.stringify(record);
}

/**
 * Parse and validate a persisted record into a domain DiscoveryResult.
 * Invalid or unsupported versions throw ResultStoreError (never silent partial objects).
 */
export function deserializeDiscoveryResult(payload: string): DiscoveryResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload) as unknown;
  } catch {
    throw new ResultStoreError('Invalid persisted result JSON');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ResultStoreError('Persisted result is not an object');
  }

  const schemaVersion = (parsed as { schemaVersion?: unknown }).schemaVersion;
  if (schemaVersion !== DISCOVERY_RESULT_RECORD_SCHEMA_VERSION) {
    throw new ResultStoreError(
      `Unsupported discovery result schema version: ${String(schemaVersion)}`
    );
  }

  const result = (parsed as { result?: unknown }).result;
  return validateDiscoveryResultShape(result);
}

function validateDiscoveryResultShape(value: unknown): DiscoveryResult {
  if (!value || typeof value !== 'object') {
    throw new ResultStoreError('Persisted result missing result body');
  }

  const r = value as Record<string, unknown>;

  requireString(r, 'id');
  requireString(r, 'profileId');
  requireString(r, 'strategyId');
  requireString(r, 'strategyVersion');
  requireString(r, 'firstSeenAt');
  requireString(r, 'lastVerifiedAt');
  requireString(r, 'lastChangedAt');
  requireLifecycle(r.lifecycle);
  requireUserState(r.userState);

  if (!r.identity || typeof r.identity !== 'object') {
    throw new ResultStoreError('Persisted result missing identity');
  }
  const identity = r.identity as Record<string, unknown>;
  if (!identity.fingerprintMaterial || typeof identity.fingerprintMaterial !== 'object') {
    throw new ResultStoreError('Persisted result missing fingerprintMaterial');
  }
  if (!identity.externalIds || typeof identity.externalIds !== 'object') {
    throw new ResultStoreError('Persisted result missing externalIds');
  }

  if (!r.canonicalPresentation || typeof r.canonicalPresentation !== 'object') {
    throw new ResultStoreError('Persisted result missing canonicalPresentation');
  }
  const presentation = r.canonicalPresentation as Record<string, unknown>;
  requireString(presentation, 'title');

  if (!r.source || typeof r.source !== 'object') {
    throw new ResultStoreError('Persisted result missing source');
  }

  if (!r.verification || typeof r.verification !== 'object') {
    throw new ResultStoreError('Persisted result missing verification');
  }
  const verification = r.verification as Record<string, unknown>;
  requireString(verification, 'status');
  requireString(verification, 'verifiedAt');
  if (!Array.isArray(verification.checks)) {
    throw new ResultStoreError('Persisted result verification.checks invalid');
  }
  if (!Array.isArray(verification.evidenceIds)) {
    throw new ResultStoreError('Persisted result verification.evidenceIds invalid');
  }

  if (!Array.isArray(r.evidence)) {
    throw new ResultStoreError('Persisted result evidence must be an array');
  }
  for (const item of r.evidence) {
    validateEvidence(item);
  }

  if (!r.score || typeof r.score !== 'object') {
    throw new ResultStoreError('Persisted result missing score');
  }
  const score = r.score as Record<string, unknown>;
  requireNumber(score, 'matchScore');
  requireNumber(score, 'confidenceScore');
  requireString(score, 'scoredAt');
  requireString(score, 'strategyVersion');
  if (!score.breakdown || typeof score.breakdown !== 'object') {
    throw new ResultStoreError('Persisted result score.breakdown invalid');
  }
  const breakdown = score.breakdown as Record<string, unknown>;
  if (!Array.isArray(breakdown.dimensions)) {
    throw new ResultStoreError('Persisted result score.breakdown.dimensions invalid');
  }

  return r as unknown as DiscoveryResult;
}

function validateEvidence(value: unknown): Evidence {
  if (!value || typeof value !== 'object') {
    throw new ResultStoreError('Persisted evidence entry invalid');
  }
  const e = value as Record<string, unknown>;
  requireString(e, 'id');
  requireString(e, 'type');
  requireString(e, 'sourceUrl');
  requireString(e, 'statement');
  requireString(e, 'capturedAt');
  return e as unknown as Evidence;
}

function requireString(obj: Record<string, unknown>, key: string): void {
  if (typeof obj[key] !== 'string' || !(obj[key] as string).trim()) {
    throw new ResultStoreError(`Persisted result missing ${key}`);
  }
}

function requireNumber(obj: Record<string, unknown>, key: string): void {
  if (typeof obj[key] !== 'number' || Number.isNaN(obj[key] as number)) {
    throw new ResultStoreError(`Persisted result missing ${key}`);
  }
}

function requireLifecycle(value: unknown): void {
  if (
    value !== 'ACTIVE' &&
    value !== 'UPDATED' &&
    value !== 'EXPIRED' &&
    value !== 'REMOVED'
  ) {
    throw new ResultStoreError('Persisted result lifecycle invalid');
  }
}

function requireUserState(value: unknown): void {
  const allowed = [
    'NEW',
    'SEEN',
    'NOTIFIED',
    'OPENED',
    'SAVED',
    'DISMISSED',
    'EXPIRED',
  ];
  if (!allowed.includes(String(value))) {
    throw new ResultStoreError('Persisted result userState invalid');
  }
}
