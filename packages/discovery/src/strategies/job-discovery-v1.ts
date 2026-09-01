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
    const text = [role, 'job', country].filter(Boolean).join(' ');
    return [
      {
        id: 'job-q1',
        intent: 'web_search' as const,
        text: String(text || 'job Germany'),
        locale: 'en',
        geography: {
          countryCode: typeof country === 'string' ? country : 'DE',
        },
        constraints: {
          employment: 'any',
        },
        priority: 0,
        metadata: { strategy: 'job-discovery', version: '1' },
      },
    ];
  },

  normalize(raw: RawCandidatePayload): NormalizedCandidateData {
    const url = raw.discoveredUrl ?? '';
    return {
      identity: {
        externalIds: url ? { url } : {},
        canonicalUrl: url || undefined,
        fingerprintMaterial: {
          title: raw.title ?? null,
          url: url || null,
          company: raw.data?.company ?? null,
        },
      },
      extracted: {
        fields: {
          title: raw.title ?? null,
          snippet: raw.snippet ?? null,
          ...(raw.data ?? {}),
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
      const title = String(input.candidate.extracted.fields.title ?? '').toLowerCase();
      const preferredRole = String(
        input.criteria.preferred.find((c) => c.key === 'role')?.value ?? ''
      ).toLowerCase();
      let role =
        preferredRole && title.includes(preferredRole.split(' ')[0] ?? '')
          ? 88
          : title.includes('engineer')
            ? 70
            : 55;
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
      ).toLowerCase();
      const location =
        locField.includes('berlin') ||
        locField.includes('munich') ||
        locField.includes('de')
          ? 85
          : locField
            ? 60
            : 50;

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
