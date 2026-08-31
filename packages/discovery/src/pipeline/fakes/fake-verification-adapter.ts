import type { Evidence } from '../../types/evidence.js';
import type { TriState } from '../../types/tri-state.js';
import type { SourceTrust } from '../../types/candidate.js';
import type { FreshnessStatus, VerificationCheck } from '../../types/verification.js';
import type {
  VerificationAdapter,
  VerificationAdapterResult,
  VerificationRequest,
} from '../adapters.js';

export type FakeVerificationOutcome = 'PASS' | 'FAIL' | 'UNKNOWN';

export type FakeVerificationAdapterOptions = {
  /** Default outcome when no per-candidate override */
  defaultOutcome?: FakeVerificationOutcome;
  outcomeByCandidateId?: Record<string, FakeVerificationOutcome>;
  /** Candidate ids that return adapter failure */
  failCandidateIds?: string[];
  /** Override official_source check outcome */
  officialSourceByCandidateId?: Record<string, TriState>;
  /** Extra checks appended after official_source */
  extraChecksByCandidateId?: Record<string, VerificationCheck[]>;
  /** Custom evidence (must be attributable); defaults generated for PASS */
  evidenceByCandidateId?: Record<string, Evidence[]>;
  /** Force invalid evidence (missing URL) for a candidate — pipeline should reject */
  invalidEvidenceCandidateIds?: string[];
  /** Claim evidenceIds that are not in the evidence list */
  unsupportedEvidenceIdsByCandidateId?: Record<string, string[]>;
  sourceTrustByCandidateId?: Record<string, SourceTrust>;
  freshness?: FreshnessStatus;
};

/**
 * Deterministic VerificationAdapter — no network / AI.
 */
export function createFakeVerificationAdapter(
  options: FakeVerificationAdapterOptions = {}
): VerificationAdapter {
  const defaultOutcome = options.defaultOutcome ?? 'PASS';

  return {
    async verify(request: VerificationRequest): Promise<VerificationAdapterResult> {
      if (options.failCandidateIds?.includes(request.candidateId)) {
        return {
          ok: false,
          reasonCode: 'VERIFY_ADAPTER_FAILED',
          message: `Simulated verification failure for ${request.candidateId}`,
        };
      }

      const outcome =
        options.outcomeByCandidateId?.[request.candidateId] ?? defaultOutcome;
      const verifiedAt = request.now();

      let officialOutcome: TriState =
        options.officialSourceByCandidateId?.[request.candidateId] ??
        (outcome === 'PASS'
          ? 'TRUE'
          : outcome === 'FAIL'
            ? 'FALSE'
            : 'UNKNOWN');

      // When policy requires official and outcome is PASS, ensure TRUE
      if (
        request.verificationPolicy.requireOfficialSource &&
        outcome === 'PASS' &&
        !options.officialSourceByCandidateId?.[request.candidateId]
      ) {
        officialOutcome = 'TRUE';
      }

      const sourceTrust: SourceTrust =
        options.sourceTrustByCandidateId?.[request.candidateId] ??
        (officialOutcome === 'TRUE'
          ? 'OFFICIAL'
          : officialOutcome === 'UNKNOWN'
            ? 'UNKNOWN'
            : request.source.trust === 'AGGREGATOR'
              ? 'AGGREGATOR'
              : 'UNKNOWN');

      const checks: VerificationCheck[] = [
        {
          id: 'official_source',
          outcome: officialOutcome,
          required: true,
          detail: `Fake official_source=${officialOutcome}`,
        },
        ...(options.extraChecksByCandidateId?.[request.candidateId] ?? []),
      ];

      // Align required policy check ids
      for (const required of request.verificationPolicy.requiredChecks) {
        if (!checks.some((c) => c.id === required.id)) {
          checks.push({
            id: required.id,
            outcome:
              outcome === 'PASS' ? 'TRUE' : outcome === 'FAIL' ? 'FALSE' : 'UNKNOWN',
            required: true,
          });
        }
      }

      let evidence: Evidence[] =
        options.evidenceByCandidateId?.[request.candidateId]?.map((e) => ({
          ...e,
        })) ?? [];

      if (options.invalidEvidenceCandidateIds?.includes(request.candidateId)) {
        evidence = [
          {
            id: `ev-invalid:${request.candidateId}`,
            type: 'OFFICIAL_SOURCE',
            sourceUrl: '',
            statement: 'Invalid — missing sourceUrl',
            capturedAt: verifiedAt,
          },
        ];
      } else if (evidence.length === 0 && outcome === 'PASS') {
        const url =
          request.canonicalUrl ??
          request.source.url ??
          'https://employer.example/verified';
        evidence = [
          {
            id: `ev:${request.candidateId}:official`,
            type: 'OFFICIAL_SOURCE',
            sourceUrl: url,
            statement: 'Official source confirmed (fake)',
            capturedAt: verifiedAt,
            contentRef: request.raw.ref,
          },
        ];
      } else if (evidence.length === 0 && (outcome === 'FAIL' || outcome === 'UNKNOWN')) {
        // Optional evidence for non-pass — still attributable if present
        const url = request.canonicalUrl ?? request.source.url;
        if (url && /^https?:\/\//i.test(url)) {
          evidence = [
            {
              id: `ev:${request.candidateId}:page`,
              type: 'CURRENT_PAGE',
              sourceUrl: url,
              statement: `Verification ${outcome} (fake)`,
              capturedAt: verifiedAt,
              contentRef: request.raw.ref,
            },
          ];
        }
      }

      const evidenceIds = evidence.map((e) => e.id);
      const unsupported =
        options.unsupportedEvidenceIdsByCandidateId?.[request.candidateId] ?? [];

      return {
        ok: true,
        result: {
          sourceTrust,
          freshness: options.freshness ?? 'CURRENT',
          checks: checks.map((c) => ({
            ...c,
            evidenceIds:
              c.id === 'official_source' && evidenceIds[0]
                ? [evidenceIds[0]!]
                : c.evidenceIds,
          })),
          verifiedAt,
          evidenceIds: [...evidenceIds, ...unsupported],
        },
        evidence,
      };
    },
  };
}
