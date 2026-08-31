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
 * E1 stub — establishes API shape for GiveawayDiscoveryStrategyV1.
 * No search, scrape, HTTP, or AI.
 */
export const giveawayDiscoveryStrategyV1: DiscoveryStrategyModule = {
  id: 'giveaway-discovery',
  version: '1',
  displayKey: 'discovery.strategy.giveawayDiscovery',

  validateCriteria(criteria: DiscoveryCriteria) {
    const country = criteria.required.find((c) => c.key === 'country');
    if (!country || country.value === null || country.value === '') {
      return { ok: false, errors: [{ path: 'required.country', code: 'REQUIRED' }] };
    }
    const free = criteria.required.find((c) => c.key === 'freeParticipation');
    if (!free || free.value !== true) {
      return {
        ok: false,
        errors: [{ path: 'required.freeParticipation', code: 'MUST_BE_TRUE' }],
      };
    }
    return { ok: true };
  },

  buildQueries(criteria: DiscoveryCriteria) {
    const country = criteria.required.find((c) => c.key === 'country')?.value;
    const prize = criteria.preferred.find((c) => c.key === 'prizeCategory')?.value;
    return [
      {
        id: 'giveaway-q1',
        intent: 'web_search' as const,
        text: ['giveaway', 'free', prize, country].filter(Boolean).join(' '),
        locale: 'en',
        geography: {
          countryCode: typeof country === 'string' ? country : 'DE',
        },
        constraints: {
          purchaseRequired: false,
          freeParticipation: true,
        },
        priority: 0,
        metadata: { strategy: 'giveaway-discovery', version: '1' },
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
          organizer: raw.data?.organizer ?? null,
          deadline: raw.data?.deadline ?? null,
        },
      },
      extracted: {
        fields: {
          title: raw.title ?? null,
          purchaseRequired: raw.data?.purchaseRequired ?? null,
          ...(raw.data ?? {}),
        },
      },
      sourceHints: raw.source,
    };
  },

  filter(candidate) {
    const purchase = candidate.extracted.fields.purchaseRequired;
    if (purchase === true) {
      return {
        action: 'REJECT',
        reasonCode: 'REJECTED_PURCHASE_REQUIRED',
      };
    }
    return { action: 'PASS' };
  },

  verificationPolicy: {
    requireVerificationPass: true,
    requiredChecks: [
      { id: 'free_participation', allowUnknown: false },
      { id: 'deadline_valid', allowUnknown: false },
    ],
    requireOfficialSource: false,
    acceptedSourceTrustForDiscovery: [
      'OFFICIAL',
      'ESTABLISHED_THIRD_PARTY',
      'AGGREGATOR',
      'COMMUNITY',
    ],
  },

  scoringPolicy: {
    dimensions: [
      { id: 'free_entry', weight: 0.35, labelKey: 'discovery.score.freeEntry' },
      { id: 'prize_value', weight: 0.25, labelKey: 'discovery.score.prizeValue' },
      { id: 'deadline', weight: 0.25, labelKey: 'discovery.score.deadline' },
      { id: 'trust', weight: 0.15, labelKey: 'discovery.score.trust' },
    ],
    minConfidenceToNotify: 75,
    minMatchToNotify: 55,
    score(input: ScoreComputationInput): Score {
      const purchase = input.candidate.extracted.fields.purchaseRequired;
      const freeEntry = purchase === false || purchase === null ? 90 : 20;

      const prizeHint = String(
        input.candidate.extracted.fields.prize ??
          input.candidate.extracted.fields.title ??
          ''
      ).toLowerCase();
      let prizeValue =
        prizeHint.includes('iphone') || prizeHint.includes('gadget') ? 80 : 55;
      const classify = input.aiEvaluation?.tasks.find((t) => t.task === 'CLASSIFY');
      if (classify?.outcome === 'INTERPRETED') {
        prizeValue = Math.min(100, prizeValue + 5);
      }

      const deadline = input.candidate.extracted.fields.deadline ? 75 : 50;
      const trust =
        input.verification.sourceTrust === 'OFFICIAL'
          ? 90
          : input.verification.sourceTrust === 'COMMUNITY'
            ? 45
            : 65;

      const dimensions = [
        {
          id: 'free_entry',
          labelKey: 'discovery.score.freeEntry',
          value: roundScore(freeEntry),
          weight: 0.35,
        },
        {
          id: 'prize_value',
          labelKey: 'discovery.score.prizeValue',
          value: roundScore(prizeValue),
          weight: 0.25,
        },
        {
          id: 'deadline',
          labelKey: 'discovery.score.deadline',
          value: roundScore(deadline),
          weight: 0.25,
        },
        {
          id: 'trust',
          labelKey: 'discovery.score.trust',
          value: roundScore(trust),
          weight: 0.15,
        },
      ];

      let confidence = input.verification.status === 'PASS' ? 70 : 30;
      if (input.evidence.length > 0) confidence += 15;
      confidence = Math.min(100, confidence);

      return {
        matchScore: weightedMatchFromDimensions(dimensions),
        confidenceScore: roundScore(confidence),
        breakdown: { dimensions },
        scoredAt: input.scoredAt,
        strategyVersion: input.strategyVersion,
      };
    },
    rank(score: Score, context) {
      const urgency =
        typeof context.opportunityHints?.deadlineHours === 'number'
          ? Math.max(0, 100 - context.opportunityHints.deadlineHours)
          : 0;
      return score.matchScore * 0.45 + score.confidenceScore * 0.35 + urgency * 0.2;
    },
  },

  freshnessPolicy: {
    reverifyEvery: 'EVERY_RUN',
    expireWhen: ['DEADLINE_PASSED', 'PAGE_GONE'],
  },

  deduplicationPolicy: {
    fingerprintFields: ['organizer', 'title', 'deadline'],
    preferSourceTrust: ['OFFICIAL', 'ESTABLISHED_THIRD_PARTY', 'AGGREGATOR', 'COMMUNITY'],
  },

  aiEvaluationPolicy: {
    enabled: true,
    tasks: ['PURCHASE_REQUIREMENT', 'CLASSIFY', 'EXTRACT'],
    rejectOn: ['REJECTED_PURCHASE_REQUIRED'],
  },

  noveltyPolicy: {
    identityFingerprintFields: ['organizer', 'title'],
    materialFingerprintFields: ['organizer', 'title', 'deadline'],
    comparePresentation: true,
    compareVerificationStatus: true,
    scoreDeltaThreshold: 5,
    notifyOnMeaningfulUpdate: false,
  },
};
