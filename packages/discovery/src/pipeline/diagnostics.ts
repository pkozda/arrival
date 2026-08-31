import type { StageDiagnostic, StageId } from './types.js';

export function stageDiagnostic(
  partial: Omit<StageDiagnostic, 'durationMs'> & { durationMs?: number; startedAtMs?: number }
): StageDiagnostic {
  const durationMs =
    partial.durationMs ??
    (partial.startedAtMs !== undefined
      ? Math.max(0, Date.now() - partial.startedAtMs)
      : 0);
  return {
    runId: partial.runId,
    stage: partial.stage,
    candidateId: partial.candidateId,
    durationMs,
    outcome: partial.outcome,
    reasonCode: partial.reasonCode,
    adapter: partial.adapter,
    operation: partial.operation,
    attempt: partial.attempt,
    costUnits: partial.costUnits,
    message: partial.message,
  };
}

export function stubStageDiagnostic(
  runId: string,
  stage: StageId,
  startedAtMs: number,
  message: string
): StageDiagnostic {
  return stageDiagnostic({
    runId,
    stage,
    startedAtMs,
    outcome: 'stub',
    reasonCode: 'STAGE_NOT_IMPLEMENTED',
    message,
  });
}
