export type StoredModuleExecution = {
  moduleId: string;
  result: unknown;
  timestamp: number;
  executionId: string;
  snapshotVersion: number;
};

const executionsBySession = new Map<string, Map<string, StoredModuleExecution[]>>();

function sessionBucket(sessionId: string): Map<string, StoredModuleExecution[]> {
  let bucket = executionsBySession.get(sessionId);
  if (!bucket) {
    bucket = new Map();
    executionsBySession.set(sessionId, bucket);
  }
  return bucket;
}

export function storeModuleExecution(
  sessionId: string,
  moduleId: string,
  result: unknown,
  executedAt: string,
  executionId: string,
  snapshotVersion: number
): void {
  const timestamp = Date.parse(executedAt);
  const execution: StoredModuleExecution = {
    moduleId,
    result,
    timestamp: Number.isNaN(timestamp) ? Date.now() : timestamp,
    executionId,
    snapshotVersion,
  };

  const bucket = sessionBucket(sessionId);
  const history = bucket.get(moduleId);
  if (history) {
    history.push(execution);
  } else {
    bucket.set(moduleId, [execution]);
  }
}

export function listModuleExecutionsByModuleId(
  sessionId: string
): Record<string, StoredModuleExecution[]> {
  const bucket = executionsBySession.get(sessionId);
  if (!bucket) return {};

  const result: Record<string, StoredModuleExecution[]> = {};
  for (const [moduleId, history] of bucket.entries()) {
    result[moduleId] = [...history].sort((a, b) => a.timestamp - b.timestamp);
  }
  return result;
}

export function listModuleExecutionsForSession(sessionId: string): StoredModuleExecution[] {
  return Object.values(listModuleExecutionsByModuleId(sessionId))
    .flat()
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function restoreModuleExecutions(
  sessionId: string,
  executionsByModuleId: Record<string, StoredModuleExecution[]>
): void {
  const bucket = new Map<string, StoredModuleExecution[]>();
  for (const [moduleId, history] of Object.entries(executionsByModuleId)) {
    bucket.set(
      moduleId,
      history.map((entry) => ({ ...entry }))
    );
  }
  executionsBySession.set(sessionId, bucket);
}

export function clearModuleExecutions(): void {
  executionsBySession.clear();
}
