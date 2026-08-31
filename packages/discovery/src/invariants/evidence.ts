import type { Evidence } from '../types/evidence.js';

export type EvidenceValidationResult =
  | { ok: true }
  | { ok: false; reason: 'MISSING_SOURCE_URL' | 'FABRICATED_SOURCE' | 'MISSING_ID' | 'MISSING_STATEMENT' };

/**
 * Evidence must be attributable to a real source (ADR-006).
 * Rejects missing URLs and AI-fabricated placeholders.
 */
export function assertAttributableEvidence(evidence: Evidence): EvidenceValidationResult {
  if (!evidence.id?.trim()) {
    return { ok: false, reason: 'MISSING_ID' };
  }
  if (!evidence.statement?.trim()) {
    return { ok: false, reason: 'MISSING_STATEMENT' };
  }
  const url = evidence.sourceUrl?.trim() ?? '';
  if (!url) {
    return { ok: false, reason: 'MISSING_SOURCE_URL' };
  }
  if (isFabricatedSourceUrl(url)) {
    return { ok: false, reason: 'FABRICATED_SOURCE' };
  }
  return { ok: true };
}

export function isFabricatedSourceUrl(sourceUrl: string): boolean {
  const normalized = sourceUrl.trim().toLowerCase();
  if (normalized === 'ai generated' || normalized === 'ai-generated') {
    return true;
  }
  if (normalized.startsWith('ai:') || normalized.startsWith('llm:')) {
    return true;
  }
  if (normalized.includes('ai-generated') || normalized.includes('fabricated')) {
    return true;
  }
  // Require a real http(s) URL for attributable evidence
  if (!/^https?:\/\//i.test(sourceUrl.trim())) {
    return true;
  }
  return false;
}

export function validateEvidenceList(
  evidence: Evidence[]
): { ok: true; evidence: Evidence[] } | { ok: false; reason: string; evidenceId?: string } {
  const out: Evidence[] = [];
  for (const item of evidence) {
    const result = assertAttributableEvidence(item);
    if (!result.ok) {
      return { ok: false, reason: result.reason, evidenceId: item.id };
    }
    out.push({ ...item });
  }
  return { ok: true, evidence: out };
}
