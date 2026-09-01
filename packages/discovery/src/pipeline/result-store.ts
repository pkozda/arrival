import type { CandidateIdentity } from '../types/candidate.js';
import type { DiscoveryResult } from '../types/result.js';

/**
 * Read-only port for existing DiscoveryResults (E2.6).
 * Writes belong to E2.7 — this port must not mutate persistence.
 */
export interface ResultStore {
  findByIdentity(
    profileId: string,
    identity: CandidateIdentity,
    identityFingerprintFields: readonly string[]
  ): Promise<DiscoveryResult | null>;
  /** Direct lookup by persisted result id (E7 state transitions, E9.1 user API). */
  getById(profileId: string, resultId: string): Promise<DiscoveryResult | null>;
  /** List all results for a profile, most recently changed first (E9.1 user API). */
  listByProfile(profileId: string): Promise<DiscoveryResult[]>;
}

export class ResultStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResultStoreError';
  }
}

/**
 * Stable identity key for Result lookup.
 * Uses configured fingerprint fields + non-URL externalIds.
 * Source URL alone must not invent a new opportunity when fingerprints match.
 */
export function resultIdentityKey(
  identity: CandidateIdentity,
  identityFingerprintFields: readonly string[]
): string {
  const external = Object.keys(identity.externalIds)
    .filter((k) => k !== 'url')
    .sort()
    .map((k) => `${k}=${identity.externalIds[k]}`)
    .join('&');
  const fp = identityFingerprintFields
    .map((field) => `${field}=${String(identity.fingerprintMaterial[field] ?? '')}`)
    .join('&');
  return `${external}|${fp}`.toLowerCase();
}
