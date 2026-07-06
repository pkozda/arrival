import { randomUUID } from 'node:crypto';
import type { BenefitNode } from '../types/benefit-node.js';
import { and, condition, or } from '../types/rules.js';
import type { NormalizationResult, RawBenefitDocument } from '../types/ingestion.js';

const CATEGORY_KEYWORDS: Record<BenefitNode['category'], string[]> = {
  federal: ['bund', 'federal', 'jobcenter', 'bürgergeld', 'baföG'],
  state: ['land', 'state', 'berlin', 'bayern', 'nrw'],
  municipal: ['stadt', 'kommune', 'municipal', 'bezirk'],
  insurance: ['krankenkasse', 'insurance', 'versicherung', 'pkv', 'gkv'],
  tax: ['steuer', 'tax', 'finanzamt', 'absetz'],
  education: ['bildung', 'weiterbildung', 'sprach', 'integration'],
  health: ['gesundheit', 'reha', 'hilfsmittel', 'medizin'],
  transport: ['ticket', 'deutschlandticket', 'öpnv', 'mobilität'],
  ngo: ['caritas', 'diakonie', 'verein', 'stiftung'],
  retail: ['rabatt', 'loyalty', 'bonus', 'cashback'],
  financial: ['riester', 'etf', 'spar', 'kredit'],
};

const BENEFIT_TYPE_KEYWORDS: Record<BenefitNode['benefitType'], string[]> = {
  cash: ['geld', 'zahlung', 'cash', 'transfer'],
  discount: ['rabatt', 'discount', 'ermäßigung'],
  refund: ['erstattung', 'refund', 'rückerstattung'],
  subsidy: ['zuschuss', 'subsidy', 'förderung'],
  taxReduction: ['steuer', 'absetz', 'tax'],
  freeService: ['kostenlos', 'free', 'gratis'],
  lowInterestProgram: ['kredit', 'darlehen', 'zins'],
};

function inferCategory(text: string, fallback?: BenefitNode['category']): BenefitNode['category'] {
  if (fallback) {
    return fallback;
  }
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return category as BenefitNode['category'];
    }
  }
  return 'federal';
}

function inferBenefitType(text: string): BenefitNode['benefitType'] {
  const lower = text.toLowerCase();
  for (const [type, keywords] of Object.entries(BENEFIT_TYPE_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return type as BenefitNode['benefitType'];
    }
  }
  return 'subsidy';
}

function inferValueEstimate(text: string): BenefitNode['valueEstimate'] {
  const euroMatches = [...text.matchAll(/(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*(?:€|eur)/gi)];
  const values = euroMatches
    .map((match) => Number(match[1]!.replace(/[.\s]/g, '')))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (values.length === 0) {
    return { min: 50, max: 500, currency: 'EUR', period: 'yearly' };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const period = /monat|month/i.test(text) ? 'monthly' : /einmal|once/i.test(text) ? 'once' : 'yearly';

  return { min, max: Math.max(min, max), currency: 'EUR', period };
}

function inferRules(text: string): BenefitNode['eligibilityRules'] {
  const lower = text.toLowerCase();
  const rules = [];

  if (/einkommen|income|netto/i.test(lower)) {
    rules.push(condition('financial.netMonthlyIncome', 'lt', 1500));
  }
  if (/kind|child|familie/i.test(lower)) {
    rules.push(condition('hasChildren', 'eq', true));
  }
  if (/schwerbehinder|disability|mobilit/i.test(lower)) {
    rules.push(
      or(
        condition('health.disabilityDegree', 'gte', 50),
        condition('health.mobilityLimitations', 'exists')
      )
    );
  }
  if (/student|ausbildung/i.test(lower)) {
    rules.push(condition('education.studentStatus', 'eq', true));
  }
  if (/miete|rent|wohnen/i.test(lower)) {
    rules.push(condition('housing.type', 'eq', 'rented'));
  }

  if (rules.length === 0) {
    rules.push(condition('location.country', 'eq', 'DE'));
  }

  return and(...rules);
}

/** Heuristic normalizer — LLM-ready port can replace this in production ingestion. */
export function heuristicNormalizeToBenefitNode(document: RawBenefitDocument): NormalizationResult {
  const text = document.rawText.trim();
  const title =
    document.title ??
    text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 8) ??
    'Untitled benefit program';

  const category = inferCategory(text, document.category);
  const benefitType = inferBenefitType(text);
  const valueEstimate = inferValueEstimate(text);

  const node: BenefitNode = {
    id: document.id ?? `benefit_${randomUUID().slice(0, 8)}`,
    title: title.slice(0, 160),
    description: text.slice(0, 2000),
    category,
    geography: document.geography ?? { country: 'DE' },
    eligibilityRules: inferRules(text),
    benefitType,
    valueEstimate,
    source: {
      authority: document.authority ?? 'Unknown authority',
      url: document.sourceUrl,
      lastUpdated: document.fetchedAt ?? new Date().toISOString(),
      ingestionLayer: document.layer,
    },
    tags: extractTags(text),
    version: 1,
    status: 'active',
    eligibilityConfidenceBaseline: 0.6,
    scoringHints: {
      accessibilityWeight: 0.5,
      effortCostPenalty: 0.35,
      timeToReceiveWeeks: 10,
      retroactivePossible: /rückwirk|rückzahl|retro/i.test(text),
      stackableWith: [],
    },
  };

  return {
    node,
    warnings: title.length > 160 ? ['Title truncated during normalization'] : [],
    confidence: 0.6,
  };
}

export function createLlmNormalizerStub(): import('../types/ingestion.js').LlmNormalizerPort {
  return async (document) => heuristicNormalizeToBenefitNode(document);
}

function extractTags(text: string): string[] {
  const candidates = [
    'health',
    'mobility',
    'housing',
    'children',
    'tax',
    'insurance',
    'education',
    'transport',
    'retroactive',
    'stackable',
  ];
  const lower = text.toLowerCase();
  return candidates.filter((tag) => lower.includes(tag));
}
