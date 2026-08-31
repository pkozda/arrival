import type { SourceTrust } from '../types/candidate.js';
import type { VerificationPolicy } from '../types/strategy.js';
import type {
  FreshnessStatus,
  VerificationCheck,
  VerificationResult,
} from '../types/verification.js';
import { withDerivedStatus } from '../invariants/verification-status.js';
import type { Evidence } from '../types/evidence.js';
import { validateEvidenceList } from '../invariants/evidence.js';

/**
 * Enforce official-source policy and re-derive VerificationStatus.
 * Aggregator / third-party trust alone cannot satisfy requireOfficialSource.
 */
export function finalizeVerificationResult(input: {
  result: Omit<VerificationResult, 'status'> & { status?: VerificationResult['status'] };
  evidence: Evidence[];
  policy: VerificationPolicy;
}):
  | { ok: true; result: VerificationResult; evidence: Evidence[] }
  | { ok: false; reason: string } {
  const validated = validateEvidenceList(input.evidence);
  if (!validated.ok) {
    return {
      ok: false,
      reason: `INVALID_EVIDENCE:${validated.reason}${validated.evidenceId ? `:${validated.evidenceId}` : ''}`,
    };
  }

  const evidenceIds = new Set(validated.evidence.map((e) => e.id));
  for (const id of input.result.evidenceIds) {
    if (!evidenceIds.has(id)) {
      return { ok: false, reason: `UNSUPPORTED_EVIDENCE_ID:${id}` };
    }
  }
  for (const check of input.result.checks) {
    for (const id of check.evidenceIds ?? []) {
      if (!evidenceIds.has(id)) {
        return { ok: false, reason: `UNSUPPORTED_EVIDENCE_ID:${id}` };
      }
    }
  }

  let checks: VerificationCheck[] = input.result.checks.map((c) => ({
    ...c,
    evidenceIds: c.evidenceIds ? [...c.evidenceIds] : undefined,
  }));
  let sourceTrust = input.result.sourceTrust;

  if (input.policy.requireOfficialSource) {
    checks = ensureOfficialSourceCheck(checks, sourceTrust);
    const official = checks.find((c) => c.id === 'official_source')!;
    // Aggregator cannot satisfy official-source requirement
    if (official.outcome === 'TRUE' && sourceTrust !== 'OFFICIAL') {
      checks = checks.map((c) =>
        c.id === 'official_source'
          ? {
              ...c,
              outcome: 'FALSE' as const,
              detail:
                c.detail ??
                'Aggregator/third-party source cannot satisfy requireOfficialSource',
            }
          : c
      );
    }
    // Align sourceTrust with official check outcome when PASS path needs OFFICIAL
    const updatedOfficial = checks.find((c) => c.id === 'official_source')!;
    if (updatedOfficial.outcome === 'TRUE') {
      sourceTrust = 'OFFICIAL';
    }
  }

  // Ensure requiredChecks from policy are marked required
  const requiredIds = new Set(input.policy.requiredChecks.map((c) => c.id));
  checks = checks.map((c) =>
    requiredIds.has(c.id) ? { ...c, required: true } : c
  );

  const result = withDerivedStatus({
    sourceTrust,
    freshness: input.result.freshness,
    checks,
    verifiedAt: input.result.verifiedAt,
    evidenceIds: [...input.result.evidenceIds],
  });

  return { ok: true, result, evidence: validated.evidence };
}

function ensureOfficialSourceCheck(
  checks: VerificationCheck[],
  sourceTrust: SourceTrust
): VerificationCheck[] {
  const existing = checks.find((c) => c.id === 'official_source');
  if (existing) {
    return checks.map((c) =>
      c.id === 'official_source' ? { ...c, required: true } : c
    );
  }
  const outcome =
    sourceTrust === 'OFFICIAL'
      ? ('TRUE' as const)
      : sourceTrust === 'UNKNOWN'
        ? ('UNKNOWN' as const)
        : ('FALSE' as const);
  return [
    ...checks,
    {
      id: 'official_source',
      outcome,
      required: true,
      detail: `Derived from sourceTrust=${sourceTrust}`,
    },
  ];
}

/** Gate for future AI stage (E2.4): only PASS survivors may enter AI. */
export function isVerificationGateOpen(candidate: {
  deterministicFilterPassed: boolean;
  rejection?: unknown;
  verification?: VerificationResult;
}): boolean {
  return (
    candidate.deterministicFilterPassed === true &&
    !candidate.rejection &&
    candidate.verification?.status === 'PASS'
  );
}

export type { FreshnessStatus };
