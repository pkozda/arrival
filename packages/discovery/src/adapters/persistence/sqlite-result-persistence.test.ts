import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createDefaultDiscoveryRegistry,
  createFakeVerificationAdapter,
  createInMemoryProfileStore,
  createSqliteResultPersistence,
  deserializeDiscoveryResult,
  DISCOVERY_RESULT_RECORD_SCHEMA_VERSION,
  emptyCriteria,
  executeDiscoveryPipeline,
  resultIdentityKey,
  ResultStoreError,
  ResultWriterError,
  serializeDiscoveryResult,
  type DiscoveryProfile,
  type DiscoveryResult,
} from '../../index.js';

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
      checks: [
        { id: 'official_source', outcome: 'TRUE', required: true, evidenceIds: ['ev-1'] },
      ],
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
    promotedFromCandidateId: 'cand:1',
    promotedFromRunId: 'run-1',
  };
  return { ...structuredClone(base), ...overrides };
}

function tempDbPath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'discovery-e41-'));
  return path.join(dir, 'results.sqlite');
}

function cleanupDb(dbPath: string) {
  try {
    rmSync(path.dirname(dbPath), { recursive: true, force: true });
  } catch {
    // best effort
  }
}

describe('E4.1 result record serialization', () => {
  it('round-trips DiscoveryResult deterministically', () => {
    const result = sampleResult();
    const payload = serializeDiscoveryResult(result);
    const parsed = deserializeDiscoveryResult(payload);
    expect(parsed).toEqual(result);
    expect(JSON.parse(payload).schemaVersion).toBe(
      DISCOVERY_RESULT_RECORD_SCHEMA_VERSION
    );
  });

  it('rejects unsupported schema version', () => {
    const bad = JSON.stringify({
      schemaVersion: 999,
      result: sampleResult(),
    });
    expect(() => deserializeDiscoveryResult(bad)).toThrow(ResultStoreError);
    expect(() => deserializeDiscoveryResult(bad)).toThrow(/Unsupported/);
  });

  it('rejects malformed JSON and invalid shapes', () => {
    expect(() => deserializeDiscoveryResult('not-json')).toThrow(ResultStoreError);
    expect(() =>
      deserializeDiscoveryResult(JSON.stringify({ schemaVersion: 1, result: {} }))
    ).toThrow(ResultStoreError);
  });
});

describe('E4.1 SQLite ResultStore + ResultWriter', () => {
  it('create + read-after-write', async () => {
    const dbPath = tempDbPath();
    const persistence = createSqliteResultPersistence({ databasePath: dbPath });
    try {
      const result = sampleResult();
      await persistence.create(result);
      const found = await persistence.findByIdentity(
        PROFILE_ID,
        result.identity,
        IDENTITY_FIELDS
      );
      expect(found).toEqual(result);
      expect(persistence.count()).toBe(1);
    } finally {
      persistence.close();
      cleanupDb(dbPath);
    }
  });

  it('update + read preserves firstSeenAt and userState', async () => {
    const dbPath = tempDbPath();
    const persistence = createSqliteResultPersistence({ databasePath: dbPath });
    try {
      const created = sampleResult();
      await persistence.create(created);
      const updated: DiscoveryResult = {
        ...structuredClone(created),
        userState: 'DISMISSED',
        lifecycle: 'UPDATED',
        lastChangedAt: '2026-08-31T10:00:00.000Z',
        canonicalPresentation: {
          title: 'Frontend Engineer — revised',
          primaryUrl: created.canonicalPresentation.primaryUrl,
        },
        firstSeenAt: created.firstSeenAt,
      };
      await persistence.update(updated);
      const found = await persistence.findByIdentity(
        PROFILE_ID,
        created.identity,
        IDENTITY_FIELDS
      );
      expect(found?.userState).toBe('DISMISSED');
      expect(found?.firstSeenAt).toBe(created.firstSeenAt);
      expect(found?.lastChangedAt).toBe('2026-08-31T10:00:00.000Z');
    } finally {
      persistence.close();
      cleanupDb(dbPath);
    }
  });

  it('merges evidence by id on update payload', async () => {
    const dbPath = tempDbPath();
    const persistence = createSqliteResultPersistence({ databasePath: dbPath });
    try {
      const created = sampleResult();
      await persistence.create(created);
      const updated = sampleResult({
        evidence: [
          ...created.evidence,
          {
            id: 'ev-2',
            type: 'LOCATION',
            sourceUrl: 'https://employer.example/jobs/1',
            statement: 'Berlin',
            capturedAt: '2026-08-31T10:00:00.000Z',
          },
        ],
        lastChangedAt: '2026-08-31T10:00:00.000Z',
        lifecycle: 'UPDATED',
      });
      await persistence.update(updated);
      const found = await persistence.findByIdentity(
        PROFILE_ID,
        created.identity,
        IDENTITY_FIELDS
      );
      expect(found?.evidence.map((e) => e.id).sort()).toEqual(['ev-1', 'ev-2']);
    } finally {
      persistence.close();
      cleanupDb(dbPath);
    }
  });

  it('missing record returns null; storage failure throws ResultStoreError', async () => {
    const dbPath = tempDbPath();
    const persistence = createSqliteResultPersistence({ databasePath: dbPath });
    try {
      const missing = await persistence.findByIdentity(
        PROFILE_ID,
        sampleResult().identity,
        IDENTITY_FIELDS
      );
      expect(missing).toBeNull();

      persistence.close();
      await expect(
        persistence.findByIdentity(PROFILE_ID, sampleResult().identity, IDENTITY_FIELDS)
      ).rejects.toBeInstanceOf(ResultStoreError);
    } finally {
      cleanupDb(dbPath);
    }
  });

  it('duplicate create is rejected', async () => {
    const dbPath = tempDbPath();
    const persistence = createSqliteResultPersistence({ databasePath: dbPath });
    try {
      const result = sampleResult();
      await persistence.create(result);
      await expect(persistence.create(result)).rejects.toBeInstanceOf(
        ResultWriterError
      );
      expect(persistence.count()).toBe(1);
    } finally {
      persistence.close();
      cleanupDb(dbPath);
    }
  });

  it('update missing record throws ResultWriterError', async () => {
    const dbPath = tempDbPath();
    const persistence = createSqliteResultPersistence({ databasePath: dbPath });
    try {
      await expect(persistence.update(sampleResult())).rejects.toBeInstanceOf(
        ResultWriterError
      );
    } finally {
      persistence.close();
      cleanupDb(dbPath);
    }
  });

  it('survives process restart (reopen same database file)', async () => {
    const dbPath = tempDbPath();
    const result = sampleResult();
    const writer = createSqliteResultPersistence({ databasePath: dbPath });
    await writer.create(result);
    writer.close();

    const reader = createSqliteResultPersistence({ databasePath: dbPath });
    try {
      const found = await reader.findByIdentity(
        PROFILE_ID,
        result.identity,
        IDENTITY_FIELDS
      );
      expect(found).toEqual(result);
    } finally {
      reader.close();
      cleanupDb(dbPath);
    }
  });

  it('rejects unsupported schema version stored in database', async () => {
    const dbPath = tempDbPath();
    const persistence = createSqliteResultPersistence({ databasePath: dbPath });
    try {
      const result = sampleResult();
      const badPayload = JSON.stringify({
        schemaVersion: 999,
        result,
      });
      // Direct insert to simulate legacy/unsupported row
      const db = (await import('better-sqlite3')).default(dbPath);
      db.prepare(
        `INSERT INTO discovery_results
          (id, profile_id, payload, schema_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        result.id,
        result.profileId,
        badPayload,
        999,
        result.firstSeenAt,
        result.lastChangedAt
      );
      db.close();

      await expect(
        persistence.findByIdentity(PROFILE_ID, result.identity, IDENTITY_FIELDS)
      ).rejects.toBeInstanceOf(ResultStoreError);
    } finally {
      persistence.close();
      cleanupDb(dbPath);
    }
  });

  it('failed write does not leave partial row on duplicate create', async () => {
    const dbPath = tempDbPath();
    const persistence = createSqliteResultPersistence({ databasePath: dbPath });
    try {
      const result = sampleResult();
      await persistence.create(result);
      await expect(persistence.create(result)).rejects.toThrow();
      expect(persistence.count()).toBe(1);
      const found = await persistence.findByIdentity(
        PROFILE_ID,
        result.identity,
        IDENTITY_FIELDS
      );
      expect(found).toEqual(result);
    } finally {
      persistence.close();
      cleanupDb(dbPath);
    }
  });
});

describe('E4.1 pipeline + durable persistence', () => {
  function jobProfile(): DiscoveryProfile {
    return {
      id: PROFILE_ID,
      userId: 'user-1',
      name: 'Jobs',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      criteria: {
        ...emptyCriteria(),
        required: [{ key: 'country', value: 'DE' }],
        preferred: [{ key: 'role', value: 'Frontend Engineer' }],
      },
      schedule: { cadence: 'manual' },
      notification: { emailEnabled: true, skipEmptyDigest: true },
      enabled: true,
      createdAt: '2026-08-30T00:00:00.000Z',
      updatedAt: '2026-08-30T00:00:00.000Z',
    };
  }

  it('executeDiscoveryPipeline persists via SQLite and survives reopen', async () => {
    const dbPath = tempDbPath();
    const persistence = createSqliteResultPersistence({ databasePath: dbPath });
    try {
      const result = await executeDiscoveryPipeline({
        profileId: PROFILE_ID,
        registry: createDefaultDiscoveryRegistry(),
        profileStore: createInMemoryProfileStore([jobProfile()]),
        resultStore: persistence,
        resultWriter: persistence,
        adapters: {
          search: {
            async search() {
              return [
                {
                  discoveredUrl: 'https://employer.example/jobs/1',
                  title: 'Frontend Engineer',
                  source: {
                    trust: 'AGGREGATOR',
                    url: 'https://employer.example/jobs/1',
                  },
                  data: { company: 'Acme', location: 'Berlin' },
                },
              ];
            },
          },
          verify: createFakeVerificationAdapter({ defaultOutcome: 'PASS' }),
        },
        now: () => '2026-08-30T14:00:00.000Z',
        runId: `run-e41-${randomUUID()}`,
      });

      const promoted = result.batch.active.find((c) => c.stage === 'PROMOTED');
      expect(promoted?.persistOutcome).toBe('CREATED');
      expect(persistence.count()).toBe(1);

      persistence.close();
      const reopened = createSqliteResultPersistence({ databasePath: dbPath });
      const stored = await reopened.findByIdentity(
        PROFILE_ID,
        promoted!.identity,
        ['title', 'company']
      );
      expect(stored?.id).toBe(promoted!.promotedResult!.id);
      expect(stored?.firstSeenAt).toBe('2026-08-30T14:00:00.000Z');
      reopened.close();
    } finally {
      cleanupDb(dbPath);
    }
  });
});
