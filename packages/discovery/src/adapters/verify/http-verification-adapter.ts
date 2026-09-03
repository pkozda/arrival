import type { ExtractedFacts, SourceTrust } from '../../types/candidate.js';
import type { Evidence, EvidenceType } from '../../types/evidence.js';
import type { FreshnessPolicy } from '../../types/strategy.js';
import type { TriState } from '../../types/tri-state.js';
import type {
  FreshnessStatus,
  VerificationCheck,
} from '../../types/verification.js';
import type {
  VerificationAdapter,
  VerificationAdapterResult,
  VerificationRequest,
} from '../../pipeline/adapters.js';
import type { RawContentStore } from '../../pipeline/fakes/raw-content-store.js';
import { deriveVerificationStatus } from '../../invariants/verification-status.js';
import { validateEvidenceList } from '../../invariants/evidence.js';
import {
  AdapterFailureError,
  assertAttributableSourceUrl,
  createInMemoryRateLimiter,
  executeWithTimeout,
  type RateLimiter,
} from '../../adapter-infra/index.js';
import { createHash } from 'node:crypto';
import {
  type HttpTransport,
} from '../http-transport.js';
import {
  employerAttributionMatches,
  isEmployerControlledDiscoveryHost,
  isNonEmployerHost,
  resolveExpectedEmployer,
  selectOfficialEmployerCandidateUrls,
} from './official-employer-resolution.js';

export const VERIFY_HTTP_PROVIDER_ID = 'http' as const;

type OfficialEmployerBridge =
  | {
      status: 'resolved';
      employerUrl: string;
      body: string;
      contentRef: string;
      httpStatus?: number;
      attributionDetail: string;
      /** E12.10: discovery URL itself vs off-domain bridge fetch. */
      via: 'direct_discovery' | 'off_domain_bridge';
    }
  | {
      status: 'unresolved';
      detail: string;
    };

export type ProductionVerificationAdapterConfig = {
  rawContentStore: RawContentStore;
  /** Optional — used only when stored raw content is insufficient for current_page */
  transport?: HttpTransport;
  rateLimiter?: RateLimiter;
  timeoutMs?: number;
  userAgent?: string;
};

const CLOSED_PATTERNS =
  /\b(no longer available|position (has been )?filled|stelle besetzt|angebot beendet|expired|bewerbung(en)? geschlossen|application closed|this (job|offer|campaign) (has )?(ended|closed|expired))\b/i;

const PURCHASE_TRUE =
  /\b(purchase required|must buy|must purchase|buy to enter|buy to participate|product purchase required|ticket purchase|kauf(en)? erforderlich|produk[tk](?:kauf)? erforderlich)\b/i;
const PURCHASE_FALSE =
  /\b(no purchase necessary|free (to )?enter|free entry|free participation|kein kauf erforderlich|teilnahme (ist )?kostenlos|gratis (teilnahme|mitmachen))\b/i;
const FREE_TRUE = PURCHASE_FALSE;

/**
 * Policy-driven deterministic VerificationAdapter (E3.5).
 * No LLM. No browser. Prefer RawContentStore; optional HTTP for current page only.
 */
export function createProductionVerificationAdapter(
  config: ProductionVerificationAdapterConfig
): VerificationAdapter {
  return createHttpVerificationAdapter(config);
}

export function createHttpVerificationAdapter(
  config: ProductionVerificationAdapterConfig
): VerificationAdapter {
  const store = config.rawContentStore;
  const transport = config.transport;
  const rateLimiter = config.rateLimiter ?? createInMemoryRateLimiter();
  const userAgent =
    config.userAgent ??
    'ArrivalAtlasDiscovery/0.1 (+https://arrival-atlas.example; verify-adapter)';

  return {
    async verify(request: VerificationRequest): Promise<VerificationAdapterResult> {
      const verifiedAt = request.now();
      try {
        const page = await resolvePageContent(request, {
          store,
          transport,
          rateLimiter,
          timeoutMs: request.timeoutMs ?? config.timeoutMs,
          userAgent,
        });

        const evidence: Evidence[] = [];
        const checks: VerificationCheck[] = [];
        let seq = 0;
        const nextId = (suffix: string) =>
          `ev:${request.candidateId}:${suffix}:${++seq}`;

        const attributableUrl = resolveAttributableUrl(request, page);
        const bodyLower = (page?.body ?? '').toLowerCase();
        const visible = page?.body ?? '';

        // E12.2 / E12.10: aggregator/third-party → direct discovery URL or off-domain employer page
        const employerBridge = await attemptOfficialEmployerBridge(
          request,
          {
            store,
            transport,
            rateLimiter,
            timeoutMs: request.timeoutMs ?? config.timeoutMs,
            userAgent,
          },
          page
        );

        const freshness = deriveFreshness({
          body:
            employerBridge?.status === 'resolved' ? employerBridge.body : visible,
          extracted: request.extracted,
          freshnessPolicy: request.freshnessPolicy,
          capturedAt: request.raw.capturedAt,
          now: verifiedAt,
          httpStatus:
            employerBridge?.status === 'resolved'
              ? employerBridge.httpStatus
              : page?.httpStatus,
        });

        // Build checks declared by policy (+ official_source when required)
        const checkIds = new Set(
          request.verificationPolicy.requiredChecks.map((c) => c.id)
        );
        if (request.verificationPolicy.requireOfficialSource) {
          checkIds.add('official_source');
        }

        // Preserve discovery source evidence separately from official verification
        if (
          employerBridge?.status === 'resolved' &&
          attributableUrl &&
          request.source.trust !== 'OFFICIAL'
        ) {
          try {
            assertAttributableSourceUrl(attributableUrl, {
              adapter: 'verify',
              operation: 'discovery_evidence',
            });
            evidence.push({
              id: nextId('discovery'),
              type: 'OTHER',
              sourceUrl: attributableUrl,
              statement: `Discovered via ${request.source.trust} source; official verification uses employer-controlled page.`,
              capturedAt: verifiedAt,
              contentRef: request.raw.ref || page?.contentRef,
            });
          } catch {
            /* discovery evidence optional — do not fail closed here */
          }
        }

        for (const checkId of checkIds) {
          const required =
            request.verificationPolicy.requiredChecks.some((c) => c.id === checkId) ||
            (checkId === 'official_source' &&
              request.verificationPolicy.requireOfficialSource);

          const evidenceUrl =
            checkId === 'official_source' && employerBridge?.status === 'resolved'
              ? employerBridge.employerUrl
              : attributableUrl;
          const evidenceContentRef =
            checkId === 'official_source' && employerBridge?.status === 'resolved'
              ? employerBridge.contentRef
              : request.raw.ref || page?.contentRef;

          const evaluated = evaluateCheck({
            checkId,
            request,
            attributableUrl: evidenceUrl,
            body:
              checkId === 'official_source' && employerBridge?.status === 'resolved'
                ? employerBridge.body
                : visible,
            bodyLower:
              checkId === 'official_source' && employerBridge?.status === 'resolved'
                ? employerBridge.body.toLowerCase()
                : bodyLower,
            freshness,
            pageAvailable: Boolean(
              checkId === 'official_source' && employerBridge?.status === 'resolved'
                ? employerBridge.body
                : page?.body
            ),
            httpStatus:
              checkId === 'official_source' && employerBridge?.status === 'resolved'
                ? employerBridge.httpStatus
                : page?.httpStatus,
            now: verifiedAt,
            employerBridge,
          });

          let evidenceIds: string[] | undefined;
          if (evaluated.outcome === 'TRUE' && evaluated.evidenceDraft && evidenceUrl) {
            try {
              assertAttributableSourceUrl(evidenceUrl, {
                adapter: 'verify',
                operation: 'evidence',
              });
              const ev: Evidence = {
                id: nextId(checkId),
                type: evaluated.evidenceDraft.type,
                sourceUrl: evidenceUrl,
                statement: evaluated.evidenceDraft.statement,
                capturedAt: verifiedAt,
                contentRef: evidenceContentRef,
              };
              evidence.push(ev);
              evidenceIds = [ev.id];
            } catch {
              // Cannot attribute — downgrade TRUE to UNKNOWN
              evaluated.outcome = 'UNKNOWN';
              evaluated.detail =
                (evaluated.detail ?? '') + ' (evidence attribution failed)';
            }
          }

          checks.push({
            id: checkId,
            outcome: evaluated.outcome,
            required,
            detail: evaluated.detail,
            evidenceIds,
          });
        }

        // sourceTrust: OFFICIAL only when already OFFICIAL or employer bridge resolved
        let sourceTrust = resolveSourceTrust(request, checks, employerBridge);

        const validated = validateEvidenceList(evidence);
        if (!validated.ok) {
          return {
            ok: false,
            reasonCode: 'VERIFY_ADAPTER_FAILED',
            message: `Invalid evidence: ${validated.reason}`,
          };
        }

        // Drop evidenceIds pointing at removed evidence; re-check TRUE without evidence → UNKNOWN
        const evidenceIdSet = new Set(validated.evidence.map((e) => e.id));
        const cleanedChecks = checks.map((c) => {
          const ids = (c.evidenceIds ?? []).filter((id) => evidenceIdSet.has(id));
          if (c.outcome === 'TRUE' && ids.length === 0 && needsEvidence(c.id)) {
            return {
              ...c,
              outcome: 'UNKNOWN' as const,
              evidenceIds: undefined,
              detail: `${c.detail ?? ''} missing attributable evidence`.trim(),
            };
          }
          return { ...c, evidenceIds: ids.length ? ids : undefined };
        });

        // Recompute trust after possible downgrades
        sourceTrust = resolveSourceTrust(
          { ...request, source: { ...request.source, trust: sourceTrust } },
          cleanedChecks,
          employerBridge
        );

        const status = deriveVerificationStatus(cleanedChecks);

        return {
          ok: true,
          result: {
            status,
            sourceTrust,
            freshness,
            checks: cleanedChecks,
            verifiedAt,
            evidenceIds: validated.evidence.map((e) => e.id),
          },
          evidence: validated.evidence,
        };
      } catch (err) {
        if (AdapterFailureError.isTimeout(err)) {
          return {
            ok: false,
            reasonCode: 'VERIFY_TIMEOUT',
            message: 'Verification timed out',
          };
        }
        if (AdapterFailureError.isCancelled(err)) {
          return {
            ok: false,
            reasonCode: 'VERIFY_CANCELLED',
            message: 'Verification cancelled',
          };
        }
        if (AdapterFailureError.isAdapterFailure(err)) {
          return {
            ok: false,
            reasonCode: 'VERIFY_ADAPTER_FAILED',
            message: sanitize(err.message),
          };
        }
        return {
          ok: false,
          reasonCode: 'VERIFY_ADAPTER_FAILED',
          message: 'Verification failed',
        };
      }
    },
  };
}

type PageContent = {
  body: string;
  contentRef?: string;
  httpStatus?: number;
  sourceUrl?: string;
};

async function resolvePageContent(
  request: VerificationRequest,
  deps: {
    store: RawContentStore;
    transport?: HttpTransport;
    rateLimiter: RateLimiter;
    timeoutMs?: number;
    userAgent: string;
  }
): Promise<PageContent | null> {
  const stored = deps.store.get(request.raw.ref);
  if (stored?.body) {
    return {
      body: stored.body,
      contentRef: request.raw.ref,
      sourceUrl: request.raw.sourceUrl,
    };
  }

  const url = request.canonicalUrl ?? request.source.url ?? request.raw.sourceUrl;
  if (!url || !deps.transport) {
    return null;
  }

  await deps.rateLimiter.acquire(`verify:${VERIFY_HTTP_PROVIDER_ID}`, {
    runId: request.run.id,
    signal: request.signal,
    timeoutMs: deps.timeoutMs,
  });

  return executeWithTimeout(
    async (signal) => {
      let response;
      try {
        response = await deps.transport!.request({
          url,
          method: 'GET',
          headers: {
            Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1',
            'User-Agent': deps.userAgent,
          },
          signal,
          maxBytes: 1_500_000,
        });
      } catch (err) {
        if (AdapterFailureError.isAdapterFailure(err)) throw err;
        throw new AdapterFailureError({
          code: 'NETWORK_ERROR',
          message: 'Verification transport network failure',
          adapter: 'verify',
          operation: 'http_get',
          retryable: true,
        });
      }

      if (response.status === 401) {
        throw new AdapterFailureError({
          code: 'AUTH_REQUIRED',
          message: 'Verification fetch authentication required',
          adapter: 'verify',
          operation: 'http_get',
          retryable: false,
        });
      }
      if (response.status === 403) {
        throw new AdapterFailureError({
          code: 'POLICY_BLOCKED',
          message: 'Verification fetch forbidden',
          adapter: 'verify',
          operation: 'http_get',
          retryable: false,
        });
      }
      if (response.status === 429) {
        throw new AdapterFailureError({
          code: 'RATE_LIMITED',
          message: 'Verification fetch rate limited',
          adapter: 'verify',
          operation: 'http_get',
          retryable: true,
        });
      }
      if (response.status >= 500) {
        throw new AdapterFailureError({
          code: 'UNAVAILABLE',
          message: `Verification fetch unavailable (HTTP ${response.status})`,
          adapter: 'verify',
          operation: 'http_get',
          retryable: true,
        });
      }
      if (response.truncated) {
        throw new AdapterFailureError({
          code: 'INVALID_RESPONSE',
          message: 'Verification fetch response oversized',
          adapter: 'verify',
          operation: 'http_get',
          retryable: false,
        });
      }

      return {
        body: response.bodyText ?? '',
        httpStatus: response.status,
        sourceUrl: response.finalUrl ?? url,
        contentRef: request.raw.ref,
      };
    },
    {
      adapter: 'verify',
      operation: 'http_get',
      timeoutMs: deps.timeoutMs,
      signal: request.signal,
      runId: request.run.id,
    }
  );
}

function resolveAttributableUrl(
  request: VerificationRequest,
  page: PageContent | null
): string | undefined {
  const candidates = [
    page?.sourceUrl,
    request.raw.sourceUrl,
    request.canonicalUrl,
    request.source.url,
  ];
  for (const c of candidates) {
    if (c && /^https?:\/\//i.test(c) && !/ai-generated|fabricated/i.test(c)) {
      return c;
    }
  }
  return undefined;
}

function evaluateCheck(input: {
  checkId: string;
  request: VerificationRequest;
  attributableUrl?: string;
  body: string;
  bodyLower: string;
  freshness: FreshnessStatus;
  pageAvailable: boolean;
  httpStatus?: number;
  now: string;
  employerBridge?: OfficialEmployerBridge | null;
}): {
  outcome: TriState;
  detail?: string;
  evidenceDraft?: { type: EvidenceType; statement: string };
} {
  const { checkId, request, attributableUrl, body, bodyLower, freshness, now } =
    input;
  const fields = request.extracted.fields;

  switch (checkId) {
    case 'official_source':
      return evaluateOfficialSource(
        request,
        attributableUrl,
        body,
        input.employerBridge
      );

    case 'current_page':
    case 'page_exists':
      return evaluateCurrentPage(input);

    case 'free_participation':
      return evaluateFreeParticipation(body, bodyLower, attributableUrl);

    case 'purchase_requirement':
      return evaluatePurchaseRequirement(body, bodyLower);

    case 'deadline_valid':
      return evaluateDeadline(fields, freshness, body, attributableUrl, now);

    case 'salary':
      return evaluateFieldPresence({
        checkId,
        fieldKey: 'salary',
        fields,
        body,
        attributableUrl,
        evidenceType: 'SALARY',
        statementPrefix: 'Page states salary/compensation as',
      });

    case 'location':
      return evaluateFieldPresence({
        checkId,
        fieldKey: 'location',
        fields,
        body,
        attributableUrl,
        evidenceType: 'LOCATION',
        statementPrefix: 'Page states location as',
      });

    case 'employment_type':
    case 'employmentType':
      return evaluateFieldPresence({
        checkId,
        fieldKey: 'employmentType',
        fields,
        body,
        attributableUrl,
        evidenceType: 'EMPLOYMENT_TYPE',
        statementPrefix: 'Page states employment type as',
      });

    default:
      return {
        outcome: 'UNKNOWN',
        detail: `No deterministic verifier for check id=${checkId}`,
      };
  }
}

function evaluateOfficialSource(
  request: VerificationRequest,
  attributableUrl: string | undefined,
  body: string,
  employerBridge?: OfficialEmployerBridge | null
): {
  outcome: TriState;
  detail?: string;
  evidenceDraft?: { type: EvidenceType; statement: string };
} {
  const trust = request.source.trust;

  // E12.2 bridge: aggregator/third-party may reach OFFICIAL only via fetched employer page
  if (employerBridge?.status === 'resolved') {
    if (CLOSED_PATTERNS.test(employerBridge.body)) {
      return {
        outcome: 'FALSE',
        detail: 'Official employer page indicates opportunity closed/expired',
        evidenceDraft: {
          type: 'OFFICIAL_SOURCE',
          statement: 'Official employer page indicates the opportunity is closed or expired.',
        },
      };
    }
    if (!employerBridge.body.trim()) {
      return {
        outcome: 'UNKNOWN',
        detail: 'Official employer page fetched but empty',
      };
    }
    return {
      outcome: 'TRUE',
      detail: `Official employer page verified after ${trust} discovery (${employerBridge.attributionDetail})`,
      evidenceDraft: {
        type: 'OFFICIAL_SOURCE',
        statement:
          employerBridge.via === 'direct_discovery'
            ? 'Employer-controlled discovery URL attributed under E12.5; search provenance alone is insufficient.'
            : 'Employer-controlled job page fetched and attributed; aggregator discovery alone is insufficient.',
      },
    };
  }

  if (employerBridge?.status === 'unresolved' && trust !== 'OFFICIAL') {
    return {
      outcome: 'UNKNOWN',
      detail: employerBridge.detail,
    };
  }

  // Aggregator / community / third-party cannot be upgraded without separate official discovery
  if (trust === 'AGGREGATOR' || trust === 'COMMUNITY') {
    return {
      outcome: 'UNKNOWN',
      detail:
        'Candidate source is not OFFICIAL; official-site discovery did not resolve an attributable employer page',
    };
  }

  if (trust === 'ESTABLISHED_THIRD_PARTY') {
    return {
      outcome: 'UNKNOWN',
      detail:
        'ESTABLISHED_THIRD_PARTY is not OFFICIAL; official-site discovery did not resolve an attributable employer page',
    };
  }

  if (trust !== 'OFFICIAL') {
    return {
      outcome: 'UNKNOWN',
      detail: `sourceTrust=${trust} insufficient for official_source`,
    };
  }

  if (!attributableUrl) {
    return {
      outcome: 'UNKNOWN',
      detail: 'Official trust claimed but no attributable source URL',
    };
  }

  if (!body.trim()) {
    return {
      outcome: 'UNKNOWN',
      detail: 'Official URL present but page content unavailable',
    };
  }

  if (CLOSED_PATTERNS.test(body)) {
    return {
      outcome: 'FALSE',
      detail: 'Official page indicates opportunity closed/expired',
      evidenceDraft: {
        type: 'OFFICIAL_SOURCE',
        statement: 'Official page indicates the opportunity is closed or expired.',
      },
    };
  }

  // Presence of attributable official URL + readable page content
  return {
    outcome: 'TRUE',
    detail: 'Official source URL with attributable page content',
    evidenceDraft: {
      type: 'OFFICIAL_SOURCE',
      statement: 'Official source page is reachable and attributable.',
    },
  };
}

function evaluateCurrentPage(input: {
  attributableUrl?: string;
  body: string;
  freshness: FreshnessStatus;
  pageAvailable: boolean;
  httpStatus?: number;
}): {
  outcome: TriState;
  detail?: string;
  evidenceDraft?: { type: EvidenceType; statement: string };
} {
  if (input.httpStatus !== undefined && input.httpStatus >= 400) {
    return {
      outcome: 'FALSE',
      detail: `Page HTTP status ${input.httpStatus}`,
    };
  }
  if (!input.pageAvailable || !input.body.trim()) {
    return {
      outcome: 'UNKNOWN',
      detail: 'Current page content unavailable',
    };
  }
  if (CLOSED_PATTERNS.test(input.body)) {
    return {
      outcome: 'FALSE',
      detail: 'Page marks opportunity closed',
      evidenceDraft: {
        type: 'CURRENT_PAGE',
        statement: 'Page text indicates the opportunity is closed or no longer available.',
      },
    };
  }
  if (!input.attributableUrl) {
    return {
      outcome: 'UNKNOWN',
      detail: 'Page content present but no attributable URL',
    };
  }
  return {
    outcome: 'TRUE',
    detail: 'Current page content available',
    evidenceDraft: {
      type: 'CURRENT_PAGE',
      statement: 'Fetched page content is present and attributable.',
    },
  };
}

function evaluateFreeParticipation(
  body: string,
  _bodyLower: string,
  attributableUrl?: string
): {
  outcome: TriState;
  detail?: string;
  evidenceDraft?: { type: EvidenceType; statement: string };
} {
  if (!body.trim()) {
    return { outcome: 'UNKNOWN', detail: 'No page content for free_participation' };
  }
  if (PURCHASE_TRUE.test(body) && !PURCHASE_FALSE.test(body)) {
    return {
      outcome: 'FALSE',
      detail: 'Page explicitly requires purchase',
      evidenceDraft: attributableUrl
        ? {
            type: 'PARTICIPATION_REQUIREMENT',
            statement: 'Page text requires a purchase to participate.',
          }
        : undefined,
    };
  }
  if (FREE_TRUE.test(body)) {
    return {
      outcome: 'TRUE',
      detail: 'Page explicitly states free participation',
      evidenceDraft: attributableUrl
        ? {
            type: 'PARTICIPATION_REQUIREMENT',
            statement: 'Page text states participation is free / no purchase necessary.',
          }
        : undefined,
    };
  }
  // Absence of purchase language ≠ free
  return {
    outcome: 'UNKNOWN',
    detail: 'Page does not establish free participation',
  };
}

function evaluatePurchaseRequirement(
  body: string,
  _bodyLower: string
): {
  outcome: TriState;
  detail?: string;
  evidenceDraft?: { type: EvidenceType; statement: string };
} {
  if (!body.trim()) {
    return { outcome: 'UNKNOWN', detail: 'No page content for purchase_requirement' };
  }
  if (PURCHASE_TRUE.test(body) && !PURCHASE_FALSE.test(body)) {
    return {
      outcome: 'TRUE',
      detail: 'Purchase required by page text',
      evidenceDraft: {
        type: 'PARTICIPATION_REQUIREMENT',
        statement: 'Page text requires a purchase to participate.',
      },
    };
  }
  if (PURCHASE_FALSE.test(body)) {
    return {
      outcome: 'FALSE',
      detail: 'Page states no purchase necessary',
      evidenceDraft: {
        type: 'PARTICIPATION_REQUIREMENT',
        statement: 'Page text states no purchase is necessary.',
      },
    };
  }
  return {
    outcome: 'UNKNOWN',
    detail: 'Purchase requirement not established by page text',
  };
}

function evaluateDeadline(
  fields: ExtractedFacts['fields'],
  freshness: FreshnessStatus,
  body: string,
  attributableUrl: string | undefined,
  now: string
): {
  outcome: TriState;
  detail?: string;
  evidenceDraft?: { type: EvidenceType; statement: string };
} {
  if (freshness === 'EXPIRED' || CLOSED_PATTERNS.test(body)) {
    return {
      outcome: 'FALSE',
      detail: 'Deadline passed or opportunity expired',
      evidenceDraft: attributableUrl
        ? {
            type: 'DEADLINE',
            statement: 'Page or metadata indicates the opportunity/deadline has expired.',
          }
        : undefined,
    };
  }

  const deadline = fields.deadline;
  if (deadline == null || deadline === '') {
    return {
      outcome: 'UNKNOWN',
      detail: 'No deadline established on page',
    };
  }

  const parsed = Date.parse(String(deadline));
  const nowMs = Date.parse(now);
  if (Number.isNaN(parsed) || Number.isNaN(nowMs)) {
    if (attributableUrl && String(deadline) && body.includes(String(deadline))) {
      return {
        outcome: 'UNKNOWN',
        detail: 'Deadline present but not machine-comparable',
        evidenceDraft: {
          type: 'DEADLINE',
          statement: `Page states deadline as ${String(deadline)}.`,
        },
      };
    }
    return { outcome: 'UNKNOWN', detail: 'Deadline not machine-comparable' };
  }

  if (parsed < nowMs) {
    return {
      outcome: 'FALSE',
      detail: 'Deadline is in the past',
      evidenceDraft: attributableUrl
        ? {
            type: 'DEADLINE',
            statement: `Page deadline ${String(deadline)} is in the past.`,
          }
        : undefined,
    };
  }

  return {
    outcome: 'TRUE',
    detail: 'Deadline is in the future',
    evidenceDraft: attributableUrl
      ? {
          type: 'DEADLINE',
          statement: `Page states deadline as ${String(deadline)}.`,
        }
      : undefined,
  };
}

/**
 * Extracted field presence alone is insufficient — value must appear in attributable page body.
 */
function evaluateFieldPresence(input: {
  checkId: string;
  fieldKey: string;
  fields: ExtractedFacts['fields'];
  body: string;
  attributableUrl?: string;
  evidenceType: EvidenceType;
  statementPrefix: string;
}): {
  outcome: TriState;
  detail?: string;
  evidenceDraft?: { type: EvidenceType; statement: string };
} {
  const value = input.fields[input.fieldKey];
  if (value == null || value === '') {
    return {
      outcome: 'UNKNOWN',
      detail: `Extracted ${input.fieldKey} not established`,
    };
  }
  const asText = String(value);
  if (!input.body || !input.body.includes(asText)) {
    return {
      outcome: 'UNKNOWN',
      detail: `Extracted ${input.fieldKey} not confirmed in attributable page body`,
    };
  }
  if (!input.attributableUrl) {
    return {
      outcome: 'UNKNOWN',
      detail: `No attributable URL for ${input.checkId}`,
    };
  }
  return {
    outcome: 'TRUE',
    detail: `${input.fieldKey} confirmed in page body`,
    evidenceDraft: {
      type: input.evidenceType,
      statement: `${input.statementPrefix} ${asText}.`,
    },
  };
}

function deriveFreshness(input: {
  body: string;
  extracted: ExtractedFacts;
  freshnessPolicy?: FreshnessPolicy;
  capturedAt?: string;
  now: string;
  httpStatus?: number;
}): FreshnessStatus {
  if (input.httpStatus !== undefined && input.httpStatus === 404) {
    return 'EXPIRED';
  }
  if (CLOSED_PATTERNS.test(input.body)) {
    return 'EXPIRED';
  }

  const expireWhen = input.freshnessPolicy?.expireWhen ?? [];
  if (expireWhen.includes('MARKED_CLOSED') && CLOSED_PATTERNS.test(input.body)) {
    return 'EXPIRED';
  }
  if (expireWhen.includes('PAGE_GONE') && input.httpStatus === 404) {
    return 'EXPIRED';
  }
  if (expireWhen.includes('DEADLINE_PASSED')) {
    const deadline = input.extracted.fields.deadline;
    if (deadline != null && deadline !== '') {
      const parsed = Date.parse(String(deadline));
      if (!Number.isNaN(parsed) && parsed < Date.parse(input.now)) {
        return 'EXPIRED';
      }
    }
  }

  if (input.body.trim() && input.capturedAt) {
    return 'CURRENT';
  }
  if (input.body.trim()) {
    return 'CURRENT';
  }
  return 'UNKNOWN';
}

function resolveSourceTrust(
  request: VerificationRequest,
  checks: VerificationCheck[],
  employerBridge?: OfficialEmployerBridge | null
): SourceTrust {
  const official = checks.find((c) => c.id === 'official_source');
  // Bridge path: official TRUE only after employer page fetch + attribution
  if (
    official?.outcome === 'TRUE' &&
    employerBridge?.status === 'resolved'
  ) {
    return 'OFFICIAL';
  }
  // Never claim OFFICIAL unless check is TRUE and original trust was already OFFICIAL
  // (finalizeVerificationResult also enforces this)
  if (official?.outcome === 'TRUE' && request.source.trust === 'OFFICIAL') {
    return 'OFFICIAL';
  }
  return request.source.trust;
}

/**
 * E12.2 / E12.10 — When discovery trust is not OFFICIAL and strategy requires
 * official source, resolve an attributable employer-controlled job page.
 *
 * Path A (E12.10): discovery URL itself when hostname authority matches employer
 * and E12.5 attribution succeeds.
 * Path B (E12.2): off-domain employer URL from aggregator page facts.
 *
 * Fail closed. Never upgrades a third-party aggregator host via body mention alone.
 */
async function attemptOfficialEmployerBridge(
  request: VerificationRequest,
  deps: {
    store: RawContentStore;
    transport?: HttpTransport;
    rateLimiter: RateLimiter;
    timeoutMs?: number;
    userAgent: string;
  },
  discoveryPage?: PageContent | null
): Promise<OfficialEmployerBridge | null> {
  if (!request.verificationPolicy.requireOfficialSource) {
    return null;
  }
  if (request.source.trust === 'OFFICIAL') {
    return null;
  }

  const discoveryUrl =
    request.canonicalUrl ?? request.source.url ?? request.raw.sourceUrl;
  if (!discoveryUrl) {
    return {
      status: 'unresolved',
      detail:
        'Candidate source is not OFFICIAL; no discovery URL available for official-site attribution',
    };
  }

  const expectedEmployer = resolveExpectedEmployer(request.extracted, {
    discoveryUrl,
  });
  if (!expectedEmployer) {
    return {
      status: 'unresolved',
      detail:
        'Candidate source is not OFFICIAL; no employer name available for official-site attribution',
    };
  }

  const expectedTitle =
    typeof request.extracted.fields.title === 'string'
      ? request.extracted.fields.title
      : typeof request.identity.fingerprintMaterial.title === 'string'
        ? String(request.identity.fingerprintMaterial.title)
        : undefined;

  let lastDetail =
    'Candidate source is not OFFICIAL; official-site discovery did not resolve an attributable employer page';

  // Path A — direct employer-controlled discovery URL (E12.10)
  if (
    isEmployerControlledDiscoveryHost({
      discoveryUrl,
      expectedEmployer,
    })
  ) {
    const direct = await resolveDirectDiscoveryEmployerPage({
      discoveryUrl,
      discoveryPage,
      request,
      deps,
      expectedEmployer,
      expectedTitle,
    });
    if (direct.status === 'resolved') {
      return direct;
    }
    lastDetail = direct.detail;
  }

  // Path B — off-domain employer bridge (E12.2)
  const candidates = selectOfficialEmployerCandidateUrls({
    discoveryUrl,
    extracted: request.extracted,
  });
  if (candidates.length === 0) {
    return {
      status: 'unresolved',
      detail:
        lastDetail ===
        'Candidate source is not OFFICIAL; official-site discovery did not resolve an attributable employer page'
          ? 'Candidate source is not OFFICIAL; no off-domain employer job URL found on discovery page'
          : lastDetail,
    };
  }

  if (!deps.transport) {
    return {
      status: 'unresolved',
      detail:
        'Candidate source is not OFFICIAL; official employer fetch transport unavailable',
    };
  }

  for (const candidate of candidates) {
    const fetched = await fetchOfficialEmployerPage(candidate.url, request, deps);
    if (!fetched.ok) {
      lastDetail = fetched.detail;
      continue;
    }

    const attribution = employerAttributionMatches({
      expectedEmployer,
      pageUrl: fetched.finalUrl,
      pageBody: fetched.body,
      expectedTitle,
    });
    if (!attribution.ok) {
      lastDetail = attribution.detail;
      continue;
    }

    const contentHash = createHash('sha256')
      .update(fetched.body, 'utf8')
      .digest('hex');
    const contentRef = `raw:official:${contentHash}`;
    deps.store.put(contentRef, {
      body: fetched.body,
      contentType: fetched.contentType ?? 'text/html',
    });

    return {
      status: 'resolved',
      employerUrl: fetched.finalUrl,
      body: fetched.body,
      contentRef,
      httpStatus: fetched.httpStatus,
      attributionDetail: attribution.detail,
      via: 'off_domain_bridge',
    };
  }

  return {
    status: 'unresolved',
    detail: lastDetail,
  };
}

async function resolveDirectDiscoveryEmployerPage(input: {
  discoveryUrl: string;
  discoveryPage?: PageContent | null;
  request: VerificationRequest;
  deps: {
    store: RawContentStore;
    transport?: HttpTransport;
    rateLimiter: RateLimiter;
    timeoutMs?: number;
    userAgent: string;
  };
  expectedEmployer: string;
  expectedTitle?: string;
}): Promise<OfficialEmployerBridge> {
  const { discoveryUrl, discoveryPage, request, deps, expectedEmployer, expectedTitle } =
    input;

  let body = discoveryPage?.body?.trim() ? discoveryPage.body : '';
  let finalUrl = discoveryUrl;
  let httpStatus = discoveryPage?.httpStatus;
  let contentType = 'text/html';

  if (!body) {
    if (!deps.transport) {
      return {
        status: 'unresolved',
        detail:
          'Candidate source is not OFFICIAL; discovery page content unavailable for direct employer attribution',
      };
    }
    const fetched = await fetchOfficialEmployerPage(discoveryUrl, request, deps);
    if (!fetched.ok) {
      return { status: 'unresolved', detail: fetched.detail };
    }
    body = fetched.body;
    finalUrl = fetched.finalUrl;
    httpStatus = fetched.httpStatus;
    contentType = fetched.contentType ?? 'text/html';
  }

  // Redirect / final URL must still look employer-controlled
  if (
    !isEmployerControlledDiscoveryHost({
      discoveryUrl: finalUrl,
      expectedEmployer,
    })
  ) {
    return {
      status: 'unresolved',
      detail:
        'Discovery URL is not an employer-controlled host for the expected employer',
    };
  }

  const attribution = employerAttributionMatches({
    expectedEmployer,
    pageUrl: finalUrl,
    pageBody: body,
    expectedTitle,
  });
  if (!attribution.ok) {
    return { status: 'unresolved', detail: attribution.detail };
  }

  const contentHash = createHash('sha256').update(body, 'utf8').digest('hex');
  const contentRef =
    discoveryPage?.contentRef && body === discoveryPage.body
      ? discoveryPage.contentRef
      : `raw:official:${contentHash}`;
  if (contentRef.startsWith('raw:official:')) {
    deps.store.put(contentRef, {
      body,
      contentType,
    });
  }

  return {
    status: 'resolved',
    employerUrl: finalUrl,
    body,
    contentRef,
    httpStatus,
    attributionDetail: attribution.detail,
    via: 'direct_discovery',
  };
}

async function fetchOfficialEmployerPage(
  url: string,
  request: VerificationRequest,
  deps: {
    transport?: HttpTransport;
    rateLimiter: RateLimiter;
    timeoutMs?: number;
    userAgent: string;
  }
): Promise<
  | {
      ok: true;
      body: string;
      finalUrl: string;
      httpStatus: number;
      contentType?: string;
    }
  | { ok: false; detail: string }
> {
  if (!deps.transport) {
    return { ok: false, detail: 'Official employer fetch transport unavailable' };
  }

  try {
    await deps.rateLimiter.acquire(`verify:${VERIFY_HTTP_PROVIDER_ID}`, {
      runId: request.run.id,
      signal: request.signal,
      timeoutMs: deps.timeoutMs,
    });

    const response = await executeWithTimeout(
      async (signal) => {
        try {
          return await deps.transport!.request({
            url,
            method: 'GET',
            headers: {
              Accept:
                'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1',
              'User-Agent': deps.userAgent,
            },
            signal,
            maxBytes: 1_500_000,
          });
        } catch (err) {
          if (AdapterFailureError.isAdapterFailure(err)) throw err;
          throw new AdapterFailureError({
            code: 'NETWORK_ERROR',
            message: 'Official employer fetch network failure',
            adapter: 'verify',
            operation: 'official_employer_get',
            retryable: true,
          });
        }
      },
      {
        adapter: 'verify',
        operation: 'official_employer_get',
        timeoutMs: deps.timeoutMs,
        signal: request.signal,
        runId: request.run.id,
      }
    );

    if (response.status >= 400) {
      return {
        ok: false,
        detail: `Official employer page fetch failed (HTTP ${response.status})`,
      };
    }
    if (response.truncated) {
      return {
        ok: false,
        detail: 'Official employer page response oversized',
      };
    }
    const body = response.bodyText ?? '';
    if (!body.trim()) {
      return {
        ok: false,
        detail: 'Official employer page empty',
      };
    }

    const finalUrl = response.finalUrl ?? url;
    // Redirect into a known non-employer host must not become OFFICIAL
    try {
      const host = new URL(finalUrl).hostname.toLowerCase();
      if (isNonEmployerHost(host)) {
        return {
          ok: false,
          detail: 'Official employer fetch redirected to a non-employer host',
        };
      }
    } catch {
      return { ok: false, detail: 'Official employer final URL invalid' };
    }

    return {
      ok: true,
      body,
      finalUrl,
      httpStatus: response.status,
      contentType: response.headers?.['content-type'],
    };
  } catch (err) {
    if (AdapterFailureError.isTimeout(err)) {
      return { ok: false, detail: 'Official employer page fetch timed out' };
    }
    if (AdapterFailureError.isCancelled(err)) {
      return { ok: false, detail: 'Official employer page fetch cancelled' };
    }
    return {
      ok: false,
      detail: 'Official employer page fetch failed',
    };
  }
}

function needsEvidence(checkId: string): boolean {
  return [
    'official_source',
    'current_page',
    'page_exists',
    'free_participation',
    'purchase_requirement',
    'deadline_valid',
    'salary',
    'location',
    'employment_type',
    'employmentType',
  ].includes(checkId);
}

function sanitize(message: string): string {
  if (/(authorization|api[_-]?key|cookie|bearer|set-cookie)/i.test(message)) {
    return '[redacted]';
  }
  return message.replace(/[A-Za-z0-9_\-]{32,}/g, '[redacted]');
}
