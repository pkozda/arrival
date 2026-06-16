export type StoredModuleExecution = {
  moduleId: string;
  result: unknown;
  timestamp: number;
  executionId: string;
  snapshotVersion: number;
};

const executionsBySession = new Map<string, Map<string, StoredModuleExecution>>();

function sessionBucket(sessionId: string): Map<string, StoredModuleExecution> {
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
  sessionBucket(sessionId).set(moduleId, {
    moduleId,
    result,
    timestamp: Number.isNaN(timestamp) ? Date.now() : timestamp,
    executionId,
    snapshotVersion,
  });
}

export function listModuleExecutionsForSession(sessionId: string): StoredModuleExecution[] {
  const bucket = executionsBySession.get(sessionId);
  if (!bucket) return [];

  return Array.from(bucket.values()).sort((a, b) => a.timestamp - b.timestamp);
}

export function clearModuleExecutions(): void {
  executionsBySession.clear();
}
