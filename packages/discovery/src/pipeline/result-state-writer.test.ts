import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createInMemoryResultStore,
  createResultStateWriter,
  createSqliteResultPersistence,
  resultIdentityKey,
  ResultStateWriterError,
  ResultWriterError,
  type DiscoveryResult,
} from '../index.js';

const IDENTITY_FIELDS = ['title', 'company'] as const;
const PROFILE_ID = 'profile-job';

function sampleResult(overrides: Partial<DiscoveryResult> = {}): DiscoveryResult {
  const identity = {
    externalIds: { url: 'https://employer.example/jobs/1' },
    canonicalUrl: 'https://employer.example/jobs/1',
    fingerprintMaterial: { title: 'Frontend Engineer', company: 'Acme' },
  };
  const base: DiscoveryResult = {
    id: `result:${PROFILE_ID}:${resultIdentityKey(identity, IDENTITY_FIELDS)}`,
    profileId: PROFILE_ID,
    strategyId: 'job-discovery',
    strategyVersion: '1',
    identity,
    canonicalPresentation: {
      title: 'Frontend Engineer',
      primaryUrl: 'https://employer.example/jobs/1',
    },
    source: { trust: 'AGGREGATOR', url: 'https://employer.example/jobs/1' },
    verification: {
      status: 'PASS',
      sourceTrust: 'OFFICIAL',
      freshness: 'CURRENT',
      checks: [{ id: 'official_source', outcome: 'TRUE', required: true }],
      verifiedAt: '2026-08-30T14:00:00.000Z',
      evidenceIds: ['ev-1'],
    },
    evidence: [
      {
        id: 'ev-1',
        type: 'OFFICIAL_SOURCE',
        sourceUrl: 'https://employer.example/jobs/1',
        statement: 'Official listing',
        capturedAt: '2026-08-30T14:00:00.000Z',
      },
    ],
    score: {
      matchScore: 82,
      confidenceScore: 88,
      breakdown: {
        dimensions: [
          { id: 'role', labelKey: 'discovery.score.role', value: 80, weight: 0.3 },
        ],
      },
      scoredAt: '2026-08-30T14:00:00.000Z',
      strategyVersion: '1',
    },
    lifecycle: 'ACTIVE',
    userState: 'NEW',
    firstSeenAt: '2026-08-30T14:00:00.000Z',
    lastVerifiedAt: '2026-08-30T14:00:00.000Z',
    lastChangedAt: '2026-08-30T14:00:00.000Z',
  };
  return { ...structuredClone(base), ...overrides };
}

function tempDbPath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'discovery-e72-writer-'));
  return path.join(dir, 'results.sqlite');
}

function cleanupDb(dbPath: string) {
  try {
    rmSync(path.dirname(dbPath), { recursive: true, force: true });
  } catch {
    // best effort
  }
}

describe('E7.2 ResultStateWriter', () => {
  it('persists NOTIFIED transition and preserves unrelated fields', async () => {
    const store = createInMemoryResultStore();
    const result = sampleResult({ userState: 'NEW' });
    await store.create(result);
    const writer = createResultStateWriter({ store, writer: store });

    const updated = await writer.transitionUserState({
      profileId: PROFILE_ID,
      resultId: result.id,
      to: 'NOTIFIED',
      actor: 'notification',
      at: '2026-08-31T10:10:00.000Z',
    });

    expect(updated.userState).toBe('NOTIFIED');
    expect(updated.id).toBe(result.id);
    expect(updated.identity).toEqual(result.identity);
    expect(updated.firstSeenAt).toBe(result.firstSeenAt);
    expect(updated.lastChangedAt).toBe(result.lastChangedAt);
    expect(updated.lifecycle).toBe(result.lifecycle);
    expect(store.size()).toBe(1);

    const loaded = await store.getById!(PROFILE_ID, result.id);
    expect(loaded?.userState).toBe('NOTIFIED');
  });

  it('is idempotent when already NOTIFIED', async () => {
    const store = createInMemoryResultStore();
    const result = sampleResult({ userState: 'NOTIFIED' });
    await store.create(result);
    const writer = createResultStateWriter({ store, writer: store });
    const before = store.snapshot();

    const updated = await writer.transitionUserState({
      profileId: PROFILE_ID,
      resultId: result.id,
      to: 'NOTIFIED',
      actor: 'notification',
      at: '2026-08-31T10:10:00.000Z',
    });

    expect(updated.userState).toBe('NOTIFIED');
    expect(store.snapshot()).toEqual(before);
  });

  it('rejects invalid transitions', async () => {
    const store = createInMemoryResultStore();
    const result = sampleResult({ userState: 'SAVED' });
    await store.create(result);
    const writer = createResultStateWriter({ store, writer: store });

    await expect(
      writer.transitionUserState({
        profileId: PROFILE_ID,
        resultId: result.id,
        to: 'NOTIFIED',
        actor: 'notification',
        at: '2026-08-31T10:10:00.000Z',
      })
    ).rejects.toBeInstanceOf(ResultStateWriterError);
  });

  it('throws when result is missing', async () => {
    const store = createInMemoryResultStore();
    const writer = createResultStateWriter({ store, writer: store });

    await expect(
      writer.transitionUserState({
        profileId: PROFILE_ID,
        resultId: 'result:missing',
        to: 'NOTIFIED',
        actor: 'notification',
        at: '2026-08-31T10:10:00.000Z',
      })
    ).rejects.toThrow(/Result not found/);
  });

  it('does not resurrect EXPIRED results via notification', async () => {
    const store = createInMemoryResultStore();
    const result = sampleResult({ userState: 'EXPIRED', lifecycle: 'EXPIRED' });
    await store.create(result);
    const writer = createResultStateWriter({ store, writer: store });

    await expect(
      writer.transitionUserState({
        profileId: PROFILE_ID,
        resultId: result.id,
        to: 'NOTIFIED',
        actor: 'notification',
        at: '2026-08-31T10:10:00.000Z',
      })
    ).rejects.toMatchObject({ message: 'EXPIRED_STATE_IMMUTABLE' });

    expect((await store.getById!(PROFILE_ID, result.id))?.userState).toBe('EXPIRED');
  });

  it('surfaces persistence failures as ResultStateWriterError', async () => {
    const backing = createInMemoryResultStore();
    const result = sampleResult();
    await backing.create(result);
    const writer = createResultStateWriter({
      store: backing,
      writer: {
        async update() {
          throw new ResultWriterError('disk full');
        },
        async create() {
          throw new ResultWriterError('unexpected create');
        },
      },
    });

    await expect(
      writer.transitionUserState({
        profileId: PROFILE_ID,
        resultId: result.id,
        to: 'NOTIFIED',
        actor: 'notification',
        at: '2026-08-31T10:10:00.000Z',
      })
    ).rejects.toMatchObject({ message: 'disk full' });
  });

  it('persists transitions in SQLite and survives reopen', async () => {
    const dbPath = tempDbPath();
    const persistence = createSqliteResultPersistence({ databasePath: dbPath });
    const result = sampleResult({ userState: 'NEW' });
    await persistence.create(result);
    const writer = createResultStateWriter({ store: persistence, writer: persistence });
    await writer.transitionUserState({
      profileId: PROFILE_ID,
      resultId: result.id,
      to: 'NOTIFIED',
      actor: 'notification',
      at: '2026-08-31T10:10:00.000Z',
    });
    persistence.close();

    const reopened = createSqliteResultPersistence({ databasePath: dbPath });
    try {
      const loaded = await reopened.getById!(PROFILE_ID, result.id);
      expect(loaded?.userState).toBe('NOTIFIED');
      expect(loaded?.id).toBe(result.id);
      expect(reopened.count()).toBe(1);
    } finally {
      reopened.close();
      cleanupDb(dbPath);
    }
  });
});
