import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearSnapshotVersions,
  getSnapshotVersionState,
  recordSnapshotMutation,
} from './snapshot-version-store.js';

describe('snapshot-version-store', () => {
  beforeEach(() => {
    clearSnapshotVersions();
  });

  it('starts at version 0 for new sessions', () => {
    expect(getSnapshotVersionState('sess_a')).toEqual({
      snapshotVersion: 0,
      lastMutationId: null,
    });
  });

  it('increments strictly per mutation', () => {
    const v1 = recordSnapshotMutation('sess_a', 'mut-1');
    const v2 = recordSnapshotMutation('sess_a', 'mut-2');
    const v3 = recordSnapshotMutation('sess_a', 'mut-3');

    expect(v1).toBe(1);
    expect(v2).toBe(2);
    expect(v3).toBe(3);
    expect(getSnapshotVersionState('sess_a')).toEqual({
      snapshotVersion: 3,
      lastMutationId: 'mut-3',
    });
  });

  it('isolates counters per session', () => {
    recordSnapshotMutation('sess_a', 'a-1');
    recordSnapshotMutation('sess_b', 'b-1');
    recordSnapshotMutation('sess_b', 'b-2');

    expect(getSnapshotVersionState('sess_a').snapshotVersion).toBe(1);
    expect(getSnapshotVersionState('sess_b').snapshotVersion).toBe(2);
  });
});
