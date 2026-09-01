import type { AiEvaluation } from '../types/ai-evaluation.js';

export type AiEvaluationCacheEntry = {
  fingerprint: string;
  evaluation: AiEvaluation;
};

/**
 * Provider-neutral AI evaluation lookup for run-scoped deduplication.
 * OpenAI / other adapters must not know about this cache.
 */
export type AiEvaluationCache = {
  find(fingerprint: string): AiEvaluationCacheEntry | undefined;
  save(fingerprint: string, evaluation: AiEvaluation): void;
};

/**
 * In-memory cache for one DiscoveryRun (canonical E6 closure — run-scoped dedupe).
 */
export function createInMemoryAiEvaluationCache(): AiEvaluationCache {
  const byFingerprint = new Map<string, AiEvaluationCacheEntry>();
  return {
    find(fingerprint) {
      const entry = byFingerprint.get(fingerprint);
      if (!entry) return undefined;
      return {
        fingerprint: entry.fingerprint,
        evaluation: cloneEvaluation(entry.evaluation),
      };
    },
    save(fingerprint, evaluation) {
      byFingerprint.set(fingerprint, {
        fingerprint,
        evaluation: cloneEvaluation(evaluation),
      });
    },
  };
}

function cloneEvaluation(evaluation: AiEvaluation): AiEvaluation {
  return {
    tasks: evaluation.tasks.map((t) => ({
      ...t,
      details: t.details ? { ...t.details } : undefined,
      evidenceIds: t.evidenceIds ? [...t.evidenceIds] : undefined,
    })),
    evaluatedAt: evaluation.evaluatedAt,
    modelLabel: evaluation.modelLabel,
    inputFingerprint: evaluation.inputFingerprint,
  };
}
