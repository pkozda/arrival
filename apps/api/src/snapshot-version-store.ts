type SessionVersionState = {
  snapshotVersion: number;
  lastMutationId: string | null;
};

const versionBySession = new Map<string, SessionVersionState>();

function sessionState(sessionId: string): SessionVersionState {
  let state = versionBySession.get(sessionId);
  if (!state) {
    state = { snapshotVersion: 0, lastMutationId: null };
    versionBySession.set(sessionId, state);
  }
  return state;
}

/**
 * Increments the per-session snapshot version and records the mutation id.
 * Returns the new monotonic version.
 */
export function recordSnapshotMutation(sessionId: string, mutationId: string): number {
  const state = sessionState(sessionId);
  state.snapshotVersion += 1;
  state.lastMutationId = mutationId;
  return state.snapshotVersion;
}

export function getSnapshotVersionState(sessionId: string): SessionVersionState {
  return { ...sessionState(sessionId) };
}

export function clearSnapshotVersions(): void {
  versionBySession.clear();
}
