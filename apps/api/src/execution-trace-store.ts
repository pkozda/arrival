import type { ExecutionTrace } from '@arrival-atlas/profile';

const lastTraces = new Map<string, ExecutionTrace>();

function traceKey(sessionId: string, moduleId: string): string {
  return `${sessionId}:${moduleId}`;
}

export function storeExecutionTrace(trace: ExecutionTrace): void {
  if (!trace.sessionId) return;
  lastTraces.set(traceKey(trace.sessionId, trace.moduleId), trace);
}

export function getLastExecutionTrace(
  sessionId: string,
  moduleId: string
): ExecutionTrace | null {
  return lastTraces.get(traceKey(sessionId, moduleId)) ?? null;
}

export function clearExecutionTraces(): void {
  lastTraces.clear();
}
