import type {
  AiEvaluation,
  AiEvaluationTask,
  AiEvaluationTaskResult,
} from '../../types/ai-evaluation.js';
import type { RejectionReasonCode } from '../../types/rejection.js';
import type {
  AiAdapter,
  AiAdapterResult,
  AiEvaluationRequest,
} from '../adapters.js';

export type FakeAiAdapterOptions = {
  /** Default task results for allowed tasks */
  taskResults?: AiEvaluationTaskResult[];
  /** Per-candidate overrides */
  taskResultsByCandidateId?: Record<string, AiEvaluationTaskResult[]>;
  failCandidateIds?: string[];
  modelLabel?: string;
  /** Invoke counter for tests asserting adapter was/wasn't called */
  onEvaluate?: (request: AiEvaluationRequest) => void;
};

/**
 * Deterministic AiAdapter — no network / LLM SDK.
 */
export function createFakeAiAdapter(
  options: FakeAiAdapterOptions = {}
): AiAdapter & { callCount: number } {
  const adapter = {
    callCount: 0,
    async evaluate(request: AiEvaluationRequest): Promise<AiAdapterResult> {
      adapter.callCount += 1;
      options.onEvaluate?.(request);

      if (options.failCandidateIds?.includes(request.candidateId)) {
        return {
          ok: false,
          reasonCode: 'AI_ADAPTER_FAILED',
          message: `Simulated AI failure for ${request.candidateId}`,
        };
      }

      const allowed = new Set(request.allowedTasks);
      const rawTasks =
        options.taskResultsByCandidateId?.[request.candidateId] ??
        options.taskResults ??
        defaultTasksFor(request.allowedTasks);

      // Only return tasks that were requested — never silently add others
      const tasks = rawTasks.filter((t) => allowed.has(t.task));

      const evaluation: AiEvaluation = {
        tasks: tasks.map((t) => ({ ...t, details: t.details ? { ...t.details } : undefined })),
        evaluatedAt: request.now(),
        modelLabel: options.modelLabel ?? 'fake-ai-v1',
      };

      return { ok: true, evaluation };
    },
  };

  return adapter;
}

function defaultTasksFor(
  allowed: readonly AiEvaluationTask[]
): AiEvaluationTaskResult[] {
  return allowed.map((task) => ({
    task,
    outcome: 'INTERPRETED' as const,
    interpretationConfidence: 0.8,
    details: { interpretation: `${task.toLowerCase()}_ok` },
  }));
}

/** Helper for tests: purchase-required rejection recommendation */
export function purchaseRejectTask(
  evidenceId?: string
): AiEvaluationTaskResult {
  return {
    task: 'PURCHASE_REQUIREMENT',
    outcome: 'REJECT_RECOMMENDED',
    interpretationConfidence: 0.9,
    details: { purchaseRequiredInterpretation: 'true' },
    evidenceIds: evidenceId ? [evidenceId] : undefined,
    recommendedRejection: 'REJECTED_PURCHASE_REQUIRED' as RejectionReasonCode,
  };
}
