import type { ExecutionTrace, ExecutionTraceStep } from './execution-trace.js';

/**
 * Pure, in-memory collector for execution trace steps.
 * Steps are appended in pipeline order; segment helpers sort keys for determinism.
 */
export class TraceCollector {
  private readonly steps: ExecutionTraceStep[] = [];

  record(step: ExecutionTraceStep): void {
    this.steps.push(step);
  }

  recordAll(steps: ExecutionTraceStep[]): void {
    for (const step of steps) {
      this.record(step);
    }
  }

  getSteps(): readonly ExecutionTraceStep[] {
    return this.steps;
  }

  build(params: { sessionId: string; moduleId: string }): ExecutionTrace {
    return {
      sessionId: params.sessionId,
      moduleId: params.moduleId,
      steps: [...this.steps],
    };
  }
}

/** Merge trace segments in deterministic pipeline order. */
export function aggregateTraceSteps(
  ...segments: ExecutionTraceStep[][]
): ExecutionTraceStep[] {
  return segments.flat();
}

/** Sort field-keyed steps by field name for stable ordering within a segment. */
export function sortStepsByField(
  steps: ExecutionTraceStep[],
  types: ExecutionTraceStep['type'][]
): ExecutionTraceStep[] {
  const typeSet = new Set(types);
  const matching = steps.filter((step) => typeSet.has(step.type));
  const rest = steps.filter((step) => !typeSet.has(step.type));

  matching.sort((a, b) => {
    const fieldA = 'field' in a ? a.field : '';
    const fieldB = 'field' in b ? b.field : '';
    return fieldA.localeCompare(fieldB);
  });

  return [...rest, ...matching];
}
