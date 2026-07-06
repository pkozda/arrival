import type { BenefitCluster } from '../types/cluster.js';
import type { ScoredBenefit } from '../types/scoring.js';

const THEME_KEYWORDS: Record<string, string[]> = {
  'health mobility support': ['health', 'mobility', 'disability', 'reha', 'hilfsmittel', 'transport'],
  'housing cost relief': ['housing', 'rent', 'kdu', 'wohnen', 'miete'],
  'family child support': ['child', 'kind', 'family', 'kita', 'eltern'],
  'employment transition': ['job', 'arbeitslos', 'qualification', 'weiterbildung'],
  'tax optimization': ['tax', 'steuer', 'deduction', 'absetzbar'],
  'insurance reimbursements': ['krankenkasse', 'insurance', 'reimbursement', 'zuschuss'],
};

function inferTheme(item: ScoredBenefit): string {
  if (item.benefit.clusterTheme) {
    return item.benefit.clusterTheme;
  }

  const haystack = [
    item.benefit.title,
    item.benefit.description ?? '',
    ...item.benefit.tags,
    item.benefit.category,
  ]
    .join(' ')
    .toLowerCase();

  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return theme;
    }
  }

  return `${item.benefit.category} opportunities`;
}

function areStackable(a: ScoredBenefit, b: ScoredBenefit): boolean {
  const aHints = a.benefit.scoringHints?.stackableWith ?? [];
  const bHints = b.benefit.scoringHints?.stackableWith ?? [];
  return (
    aHints.includes(b.benefit.id) ||
    bHints.includes(a.benefit.id) ||
    (a.benefit.tags.some((tag) => b.benefit.tags.includes(tag)) &&
      a.benefit.category === b.benefit.category)
  );
}

export function clusterBenefits(opportunities: ScoredBenefit[]): BenefitCluster[] {
  const byTheme = new Map<string, ScoredBenefit[]>();

  for (const item of opportunities) {
    const theme = inferTheme(item);
    const bucket = byTheme.get(theme) ?? [];
    bucket.push(item);
    byTheme.set(theme, bucket);
  }

  return [...byTheme.entries()]
    .map(([theme, benefits]) => {
      const sorted = [...benefits].sort((a, b) => b.totalScore - a.totalScore);
      const stackable =
        sorted.length > 1 &&
        sorted.every((item, index) =>
          index === 0 ? true : areStackable(sorted[0]!, item)
        );

      const combinedValueMin = sorted.reduce((sum, b) => sum + b.benefit.valueEstimate.min, 0);
      const combinedValueMax = sorted.reduce((sum, b) => sum + b.benefit.valueEstimate.max, 0);
      const combinedValueExpected = sorted.reduce((sum, b) => sum + b.annualValueEur, 0);

      const tags = [...new Set(sorted.flatMap((b) => b.benefit.tags))];

      return {
        theme,
        benefitIds: sorted.map((b) => b.benefit.id),
        benefits: sorted,
        combinedValueMin,
        combinedValueMax,
        combinedValueExpected,
        stackable,
        tags,
      };
    })
    .sort((a, b) => b.combinedValueExpected - a.combinedValueExpected);
}

export function findHiddenBenefitClusters(opportunities: ScoredBenefit[]): BenefitCluster[] {
  return clusterBenefits(opportunities).filter(
    (cluster) =>
      cluster.benefits.length >= 2 &&
      cluster.benefits.some((b) => b.matchedProbabilistically || b.benefit.scoringHints?.retroactivePossible)
  );
}
