import { normalizeRecommendations } from '@arrival-atlas/module-runtime';
import { buildActionItems } from '@arrival-atlas/module-runtime';
import { sha256Checksum } from '../sha256.js';
import type { DriftFinding } from './types.js';

export type NormalizerGoldenBaseline = {
  version: string;
  modules: Record<
    string,
    {
      recommendationIdsHash: string;
      actionIdsHash: string;
    }
  >;
};

const FINANCIAL_PAYLOAD = {
  meta: { confidence: 'high' },
  decisions: [
    {
      title: 'Tax review',
      description: 'Review options.',
      priority: 'high',
      action: 'Contact Finanzamt',
    },
  ],
  benefits: { buergergeld: { eligible: false, reasoning: [] } },
  adminRules: ['Register address within 14 days'],
};

const BENEFITS_PAYLOAD = {
  meta: { confidence: 'medium' },
  riskWarnings: [
    {
      id: 'warn-1',
      severity: 'high',
      title: 'Risk',
      description: 'Review risk.',
      category: 'legal',
      action: 'Contact Jobcenter',
    },
  ],
  recommendations: [],
};

function hashNormalizerOutput(moduleId: string, payload: unknown): {
  recommendationIdsHash: string;
  actionIdsHash: string;
} {
  const recommendations = normalizeRecommendations({ moduleId, payload });
  const actions = buildActionItems({ moduleId, payload, recommendations });

  return {
    recommendationIdsHash: sha256Checksum(
      recommendations.map((entry) => entry.id).sort()
    ),
    actionIdsHash: sha256Checksum(actions.map((entry) => entry.id).sort()),
  };
}

export function computeNormalizerGoldenHashes(): NormalizerGoldenBaseline['modules'] {
  return {
    'financial-reality': hashNormalizerOutput('financial-reality', FINANCIAL_PAYLOAD),
    'benefits-simulator': hashNormalizerOutput('benefits-simulator', BENEFITS_PAYLOAD),
  };
}

export function validateNormalizerIntegrity(
  baseline: NormalizerGoldenBaseline
): DriftFinding[] {
  const current = computeNormalizerGoldenHashes();
  const findings: DriftFinding[] = [];

  for (const [moduleId, expected] of Object.entries(baseline.modules)) {
    const actual = current[moduleId];
    if (!actual) {
      findings.push({
        moduleId,
        type: 'normalizer',
        severity: 'error',
        message: `Missing normalizer golden fixture for "${moduleId}"`,
      });
      continue;
    }

    if (actual.recommendationIdsHash !== expected.recommendationIdsHash) {
      findings.push({
        moduleId,
        type: 'normalizer',
        severity: 'error',
        message: `Recommendation id drift detected for "${moduleId}"`,
      });
    }

    if (actual.actionIdsHash !== expected.actionIdsHash) {
      findings.push({
        moduleId,
        type: 'normalizer',
        severity: 'error',
        message: `Action id drift detected for "${moduleId}"`,
      });
    }
  }

  return findings;
}

export function buildNormalizerGoldenBaseline(): NormalizerGoldenBaseline {
  return {
    version: '1.0.0',
    modules: computeNormalizerGoldenHashes(),
  };
}

export function stableNormalizerBaselineFingerprint(baseline: NormalizerGoldenBaseline): string {
  return sha256Checksum({
    version: baseline.version,
    modules: baseline.modules,
  });
}
