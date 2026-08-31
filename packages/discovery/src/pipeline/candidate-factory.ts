import type { DiscoveryCandidate, RawCandidatePayload } from '../types/candidate.js';
import type { DiscoveryCriteria } from '../types/criteria.js';

export function cloneCriteria(criteria: DiscoveryCriteria): DiscoveryCriteria {
  return {
    required: criteria.required.map((c) => ({ ...c })),
    preferred: criteria.preferred.map((c) => ({ ...c })),
    excluded: criteria.excluded.map((c) => ({ ...c })),
    flexible: criteria.flexible.map((c) => ({ ...c })),
  };
}

export function rawToCandidate(
  raw: RawCandidatePayload,
  runId: string,
  index: number,
  discoveredAt: string
): DiscoveryCandidate {
  const url = raw.discoveredUrl ?? '';
  return {
    id: `${runId}:cand:${index}`,
    runId,
    identity: {
      externalIds: url ? { url } : {},
      canonicalUrl: url || undefined,
      fingerprintMaterial: {
        title: raw.title ?? null,
        url: url || null,
      },
    },
    source: raw.source ?? { trust: 'UNKNOWN' },
    discoveredAt,
    raw: { ref: `raw:${runId}:${index}` },
    extracted: {
      fields: {
        title: raw.title ?? null,
        snippet: raw.snippet ?? null,
        ...(raw.data ?? {}),
      },
    },
    stage: 'DISCOVERED',
    deterministicFilterPassed: false,
  };
}

export function fingerprintKey(candidate: DiscoveryCandidate, fields: string[]): string {
  const parts = fields.map((field) => {
    const fromFp = candidate.identity.fingerprintMaterial[field];
    if (fromFp !== undefined && fromFp !== null) return String(fromFp);
    const fromExtracted = candidate.extracted.fields[field];
    if (fromExtracted !== undefined && fromExtracted !== null) return String(fromExtracted);
    return '';
  });
  return parts.join('|').toLowerCase();
}
