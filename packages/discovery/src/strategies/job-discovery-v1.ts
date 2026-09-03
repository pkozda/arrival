import type { DiscoveryCriteria } from '../types/criteria.js';
import type {
  NormalizedCandidateData,
  RawCandidatePayload,
} from '../types/candidate.js';
import type { DiscoveryStrategyModule } from '../types/strategy.js';
import type { Score, ScoreComputationInput } from '../types/score.js';
import {
  roundScore,
  weightedMatchFromDimensions,
} from '../invariants/score.js';

/**
 * E12.18 — Seniority adjectives are never sufficient role evidence.
 * Contentful domain tokens (e.g. frontend) drive strong matches;
 * family tokens (engineer/developer) are interchangeable, not domain.
 */
const ROLE_SENIORITY_TOKENS = new Set([
  'senior',
  'junior',
  'lead',
  'principal',
  'staff',
  'mid',
  'middle',
  'intern',
  'head',
  'chief',
]);

const ROLE_FAMILY_TOKENS = new Set([
  'engineer',
  'developer',
  'programmer',
]);

/** Adjacent title signals when preferred domain includes `frontend`. */
const FRONTEND_ADJACENT_TOKENS = new Set(['fullstack', 'ui']);

const ROLE_SCORE_STRONG = 88;
const ROLE_SCORE_PARTIAL = 40;
const ROLE_SCORE_MISMATCH = 0;
const ROLE_SCORE_NO_PREFERRED = 50;

const LOCATION_SCORE_COUNTRY_MATCH = 85;
const LOCATION_SCORE_OTHER = 60;
const LOCATION_SCORE_MISSING = 50;

/**
 * Recognized location signals per ISO country code (lowercase, diacritics-stripped).
 * Used for Jobs location scoring — not a geocoder.
 */
const COUNTRY_LOCATION_SIGNALS: Readonly<Record<string, readonly string[]>> = {
  DE: [
    'germany',
    'deutschland',
    'berlin',
    'munich',
    'muenchen',
    'munchen',
    'hamburg',
    'bremen',
    'hannover',
    'hanover',
    'cologne',
    'koeln',
    'koln',
    'frankfurt',
    'stuttgart',
    'dusseldorf',
    'leipzig',
    'dresden',
    'nuremberg',
    'nuernberg',
  ],
  AT: ['austria', 'osterreich', 'vienna', 'wien', 'graz', 'linz', 'salzburg'],
  CH: ['switzerland', 'schweiz', 'zurich', 'zuerich', 'geneva', 'bern', 'basel'],
  FR: ['france', 'paris', 'lyon', 'marseille'],
  NL: ['netherlands', 'holland', 'amsterdam', 'rotterdam', 'utrecht'],
  BE: ['belgium', 'brussels', 'bruxelles', 'antwerp'],
  GB: ['united kingdom', 'uk', 'england', 'london', 'manchester', 'edinburgh'],
  US: ['united states', 'usa', 'america'],
};

/** Strip combining marks so München → Munchen for signal matching. */
function foldLocationText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .trim();
}

function hasWholeToken(haystack: string, token: string): boolean {
  if (!token) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(haystack);
}

/**
 * True when location text matches the preferred ISO country via whole-token
 * country code, country name, or known city signals — never arbitrary substrings.
 */
export function locationMatchesPreferredCountry(
  locationRaw: string,
  countryCodeRaw: string
): boolean {
  const loc = foldLocationText(locationRaw);
  const country = countryCodeRaw.trim().toUpperCase();
  if (!loc || !country) return false;

  if (hasWholeToken(loc, country.toLowerCase())) {
    return true;
  }

  const signals = COUNTRY_LOCATION_SIGNALS[country] ?? [];
  for (const signal of signals) {
    if (hasWholeToken(loc, foldLocationText(signal))) {
      return true;
    }
  }
  return false;
}

/** Location dimension: country-aware match, else other/missing neutrals. */
export function scoreJobLocation(
  locationRaw: string,
  countryCodeRaw: string
): number {
  const loc = locationRaw.trim();
  if (!loc) {
    return LOCATION_SCORE_MISSING;
  }
  const country = countryCodeRaw.trim();
  if (!country) {
    return LOCATION_SCORE_OTHER;
  }
  return locationMatchesPreferredCountry(loc, country)
    ? LOCATION_SCORE_COUNTRY_MATCH
    : LOCATION_SCORE_OTHER;
}

/**
 * Canonical employer identity for fingerprint/novelty (`company`).
 * Prefers explicit company; falls back to organization from extraction.
 */
export function resolveJobEmployerIdentity(
  data: Record<string, string | number | boolean | null> | undefined
): string | null {
  if (!data) return null;
  const company = data.company;
  if (typeof company === 'string' && company.trim() !== '') {
    return company.trim();
  }
  const organization = data.organization;
  if (typeof organization === 'string' && organization.trim() !== '') {
    return organization.trim();
  }
  return null;
}

/** Normalize hyphen/space variants then tokenize on non-alphanumerics. */
function normalizeRoleText(value: string): string {
  return value
    .toLowerCase()
    .replace(/front[\s-]*end/g, 'frontend')
    .replace(/full[\s-]*stack/g, 'fullstack')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function roleTokens(value: string): string[] {
  const normalized = normalizeRoleText(value);
  return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
}

function titleHasFamilyToken(titleTokenSet: Set<string>): boolean {
  for (const family of ROLE_FAMILY_TOKENS) {
    if (titleTokenSet.has(family)) return true;
  }
  return false;
}

/**
 * Deterministic role dimension (title vs preferred role only).
 *
 * Rule:
 * 1. Strip seniority tokens from the preferred role.
 * 2. Remaining tokens split into domain (e.g. frontend) vs family (engineer/developer).
 * 3. STRONG when every preferred domain token appears in the normalized title
 *    (engineer↔developer interchangeable; domain alone is enough if preferred
 *    has a domain token — so "Frontend Developer" matches "… Frontend Engineer").
 * 4. PARTIAL when preferred domain includes frontend and title shows fullstack/ui
 *    without the frontend domain token.
 * 5. Otherwise MISMATCH (seniority-only / generic engineer / unrelated domain).
 */
export function scoreJobRoleRelevance(
  titleRaw: string,
  preferredRoleRaw: string
): number {
  const preferred = preferredRoleRaw.trim();
  if (!preferred) {
    return ROLE_SCORE_NO_PREFERRED;
  }

  const preferredTokens = roleTokens(preferred);
  const titleNorm = normalizeRoleText(titleRaw);
  const titleTokenSet = new Set(roleTokens(titleRaw));

  const domainTokens = preferredTokens.filter(
    (t) => !ROLE_SENIORITY_TOKENS.has(t) && !ROLE_FAMILY_TOKENS.has(t)
  );
  const preferredHasFamily = preferredTokens.some((t) => ROLE_FAMILY_TOKENS.has(t));

  if (domainTokens.length > 0) {
    const hasAllDomain = domainTokens.every(
      (d) => titleTokenSet.has(d) || titleNorm.includes(d)
    );
    if (hasAllDomain) {
      // Domain match is the contentful signal; family swap is optional.
      return ROLE_SCORE_STRONG;
    }

    if (
      domainTokens.includes('frontend') &&
      [...FRONTEND_ADJACENT_TOKENS].some((t) => titleTokenSet.has(t))
    ) {
      return ROLE_SCORE_PARTIAL;
    }

    return ROLE_SCORE_MISMATCH;
  }

  // Preferred role has no domain token (e.g. "Senior Engineer") — family only.
  if (preferredHasFamily && titleHasFamilyToken(titleTokenSet)) {
    return ROLE_SCORE_STRONG;
  }

  return ROLE_SCORE_MISMATCH;
}

/**
 * E1 stub — establishes API shape for JobDiscoveryStrategyV1.
 * No search, scrape, HTTP, or AI.
 */
export const jobDiscoveryStrategyV1: DiscoveryStrategyModule = {
  id: 'job-discovery',
  version: '1',
  displayKey: 'discovery.strategy.jobDiscovery',

  validateCriteria(criteria: DiscoveryCriteria) {
    const country = criteria.required.find((c) => c.key === 'country');
    if (!country || country.value === null || country.value === '') {
      return { ok: false, errors: [{ path: 'required.country', code: 'REQUIRED' }] };
    }
    return { ok: true };
  },

  buildQueries(criteria: DiscoveryCriteria) {
    const role = criteria.preferred.find((c) => c.key === 'role')?.value;
    const country = criteria.required.find((c) => c.key === 'country')?.value;
    const rolePhrase =
      role != null && String(role).trim() !== '' ? String(role).trim() : '';
    const countryCode =
      typeof country === 'string' && country.trim() !== '' ? country.trim() : '';

    // job-q1 — broader recall (unchanged E12.3b/E12.11 text)
    let textQ1: string;
    if (!rolePhrase && !countryCode) {
      textQ1 = 'job Germany';
    } else {
      const parts: string[] = [];
      if (rolePhrase) parts.push(rolePhrase);
      parts.push('hiring', 'vacancy');
      if (countryCode === 'DE') parts.push('Stellenangebot');
      if (countryCode) parts.push(countryCode);
      textQ1 = `${parts.join(' ')} -template -"job description" -resources`;
    }

    // job-q2 — E12.16: individual vacancy / DE application bias (Path A yield)
    // Replaces E12.12a careers/"open position"/Karriere wording that attracted D/E indexes.
    // q1 remains the unchanged retrieval control. Literal -site: exclusions only;
    // no denylist abstraction, no employer-domain site: list.
    const q2Exclusions =
      '-site:linkedin.com -site:bebee.com -site:indeed.com -site:unjobs.org -site:hirify.me';
    const q2Noise = '-template -"job description"';
    let textQ2: string;
    if (!rolePhrase && !countryCode) {
      textQ2 = `Stellenanzeige Bewerbung vacancy Germany ${q2Noise} ${q2Exclusions}`;
    } else {
      const parts: string[] = [];
      if (rolePhrase) parts.push(rolePhrase);
      if (countryCode === 'DE') {
        // Stellenanzeige/Bewerbung + Germany: vacancy/apply pages, not careers hubs;
        // full "Germany" reduces DE/Delaware ambiguity seen on q2 boards.
        parts.push('Stellenanzeige', 'Bewerbung', 'vacancy', 'Germany');
      } else {
        parts.push('vacancy', 'apply', 'hiring');
        if (countryCode) parts.push(countryCode);
      }
      textQ2 = `${parts.join(' ')} ${q2Noise} ${q2Exclusions}`;
    }

    const geography = {
      countryCode: typeof country === 'string' ? country : 'DE',
    };
    const envelope = {
      intent: 'web_search' as const,
      locale: 'en',
      geography,
      constraints: {
        employment: 'any',
      },
      priority: 0,
      metadata: { strategy: 'job-discovery', version: '1' },
    };

    return [
      { id: 'job-q1', text: textQ1, ...envelope },
      { id: 'job-q2', text: textQ2, ...envelope },
    ];
  },

  normalize(raw: RawCandidatePayload): NormalizedCandidateData {
    const url = raw.discoveredUrl ?? '';
    const employer = resolveJobEmployerIdentity(raw.data);
    const dataFields: Record<string, string | number | boolean | null> = {
      ...(raw.data ?? {}),
    };
    // Keep extracted.company aligned with fingerprint identity when only organization was set.
    if (
      employer != null &&
      (typeof dataFields.company !== 'string' || dataFields.company.trim() === '')
    ) {
      dataFields.company = employer;
    }
    return {
      identity: {
        externalIds: url ? { url } : {},
        canonicalUrl: url || undefined,
        fingerprintMaterial: {
          title: raw.title ?? null,
          url: url || null,
          company: employer,
        },
      },
      extracted: {
        fields: {
          title: raw.title ?? null,
          snippet: raw.snippet ?? null,
          ...dataFields,
        },
      },
      sourceHints: raw.source,
    };
  },

  filter(candidate, criteria) {
    const excludedRoles = criteria.excluded.filter((c) => c.key === 'role');
    const title = String(candidate.extracted.fields.title ?? '').toLowerCase();
    for (const excluded of excludedRoles) {
      const needle = String(excluded.value ?? '').toLowerCase();
      if (needle && title.includes(needle)) {
        return {
          action: 'REJECT',
          reasonCode: 'REJECTED_EXCLUDED_ROLE',
          details: { role: needle },
        };
      }
    }
    return { action: 'PASS' };
  },

  verificationPolicy: {
    requireVerificationPass: true,
    requiredChecks: [{ id: 'official_source', allowUnknown: false }],
    requireOfficialSource: true,
    acceptedSourceTrustForDiscovery: [
      'OFFICIAL',
      'ESTABLISHED_THIRD_PARTY',
      'AGGREGATOR',
    ],
  },

  scoringPolicy: {
    dimensions: [
      { id: 'role', weight: 0.3, labelKey: 'discovery.score.role' },
      { id: 'location', weight: 0.2, labelKey: 'discovery.score.location' },
      { id: 'freshness', weight: 0.2, labelKey: 'discovery.score.freshness' },
      { id: 'source', weight: 0.3, labelKey: 'discovery.score.source' },
    ],
    minConfidenceToNotify: 70,
    minMatchToNotify: 60,
    score(input: ScoreComputationInput): Score {
      const title = String(input.candidate.extracted.fields.title ?? '');
      const preferredRole = String(
        input.criteria.preferred.find((c) => c.key === 'role')?.value ?? ''
      );
      let role = scoreJobRoleRelevance(title, preferredRole);
      const relevance = input.aiEvaluation?.tasks.find((t) => t.task === 'RELEVANCE');
      if (
        relevance?.outcome === 'INTERPRETED' &&
        typeof relevance.interpretationConfidence === 'number'
      ) {
        // AI may influence role dimension — not confidenceScore directly
        role = Math.min(100, role + relevance.interpretationConfidence * 8);
      }

      const locField = String(
        input.candidate.extracted.fields.location ?? ''
      );
      const preferredCountry = String(
        input.criteria.required.find((c) => c.key === 'country')?.value ?? ''
      );
      const location = scoreJobLocation(locField, preferredCountry);

      const freshness = input.verification.freshness === 'CURRENT' ? 90 : 55;
      const source =
        input.verification.sourceTrust === 'OFFICIAL'
          ? 95
          : input.verification.sourceTrust === 'ESTABLISHED_THIRD_PARTY'
            ? 70
            : 40;

      const dimensions = [
        {
          id: 'role',
          labelKey: 'discovery.score.role',
          value: roundScore(role),
          weight: 0.3,
        },
        {
          id: 'location',
          labelKey: 'discovery.score.location',
          value: roundScore(location),
          weight: 0.2,
        },
        {
          id: 'freshness',
          labelKey: 'discovery.score.freshness',
          value: roundScore(freshness),
          weight: 0.2,
        },
        {
          id: 'source',
          labelKey: 'discovery.score.source',
          value: roundScore(source),
          weight: 0.3,
        },
      ];

      // Confidence from verification + evidence — NOT ai.interpretationConfidence
      let confidence = input.verification.status === 'PASS' ? 75 : 35;
      if (input.evidence.length > 0) confidence += 10;
      if (input.verification.sourceTrust === 'OFFICIAL') confidence += 10;
      confidence = Math.min(100, confidence);

      return {
        matchScore: weightedMatchFromDimensions(dimensions),
        confidenceScore: roundScore(confidence),
        breakdown: { dimensions },
        scoredAt: input.scoredAt,
        strategyVersion: input.strategyVersion,
      };
    },
    rank(score: Score) {
      // Strategy-owned — not a global engine formula.
      return score.matchScore * 0.6 + score.confidenceScore * 0.4;
    },
  },

  freshnessPolicy: {
    reverifyEvery: 'EVERY_RUN',
    expireWhen: ['PAGE_GONE', 'MARKED_CLOSED'],
  },

  deduplicationPolicy: {
    fingerprintFields: ['title', 'company', 'url'],
    preferSourceTrust: ['OFFICIAL', 'ESTABLISHED_THIRD_PARTY', 'AGGREGATOR'],
  },

  aiEvaluationPolicy: {
    enabled: true,
    tasks: ['SENIORITY', 'RELEVANCE', 'CLASSIFY'],
    rejectOn: ['REJECTED_EXCLUDED_ROLE'],
  },

  noveltyPolicy: {
    // URL churn alone must not invent a new opportunity
    identityFingerprintFields: ['title', 'company'],
    materialFingerprintFields: ['title', 'company'],
    materialExtractedFields: ['salary'],
    comparePresentation: true,
    compareVerificationStatus: true,
    scoreDeltaThreshold: 5,
    notifyOnMeaningfulUpdate: true,
  },
};
