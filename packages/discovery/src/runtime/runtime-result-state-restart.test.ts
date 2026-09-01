import { describe, expect, it } from 'vitest';
import {
  createDiscoveryNotificationService,
  createFakeClock,
  createFakeNotificationAdapter,
  createResultStateWriter,
  createSqliteNotificationPersistence,
  createSqliteResultPersistence,
  type DiscoveryDigest,
} from '../index.js';
import { tempPersistencePaths } from './runtime-test-helpers.js';

function sampleDigest(resultId: string): DiscoveryDigest {
  return {
    id: 'digest:run-restart',
    runId: 'run-restart',
    profileId: 'profile-job',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    generatedAt: '2026-08-31T10:05:00.000Z',
    period: { from: '2026-08-31T10:00:00.000Z', to: '2026-08-31T10:05:00.000Z' },
    entries: [
      {
        resultId,
        rank: 1,
        rankValue: 0.9,
        novelty: 'NEW',
        userState: 'NEW',
        lifecycle: 'ACTIVE',
        shouldNotify: true,
      },
    ],
    resultIds: [resultId],
    newResultIds: [resultId],
    updatedResultIds: [],
    summary: {
      totalResults: 1,
      newResults: 1,
      updatedResults: 0,
      unchangedResults: 0,
      notifiedResults: 1,
    },
  };
}

describe('E7.4 NOTIFIED survives SQLite restart', () => {
  it('notification success persists NOTIFIED across runtime-owned SQLite reopen', async () => {
    const persistence = tempPersistencePaths();
    const resultId = 'result:profile-job:restart-proof';
    const clock = createFakeClock('2026-08-31T10:10:00.000Z');
    const recipient = { userId: 'user-1', address: 'user@example.com' };

    const resultStoreA = createSqliteResultPersistence({
      databasePath: persistence.resultsDatabasePath,
    });
    await resultStoreA.create({
      id: resultId,
      profileId: 'profile-job',
      strategyId: 'job-discovery',
      strategyVersion: '1',
      identity: {
        externalIds: {},
        fingerprintMaterial: { title: 'Engineer', company: 'Acme' },
      },
      canonicalPresentation: { title: 'Engineer' },
      source: { trust: 'AGGREGATOR', url: 'https://example.com/jobs/1' },
      verification: {
        status: 'PASS',
        sourceTrust: 'OFFICIAL',
        freshness: 'CURRENT',
        checks: [],
        verifiedAt: '2026-08-30T14:00:00.000Z',
        evidenceIds: [],
      },
      evidence: [],
      score: {
        matchScore: 80,
        confidenceScore: 80,
        breakdown: { dimensions: [] },
        scoredAt: '2026-08-30T14:00:00.000Z',
        strategyVersion: '1',
      },
      lifecycle: 'ACTIVE',
      userState: 'NEW',
      firstSeenAt: '2026-08-30T14:00:00.000Z',
      lastVerifiedAt: '2026-08-30T14:00:00.000Z',
      lastChangedAt: '2026-08-30T14:00:00.000Z',
    });

    const notificationStoreA = createSqliteNotificationPersistence({
      databasePath: persistence.notificationsDatabasePath,
    });
    const serviceA = createDiscoveryNotificationService({
      store: notificationStoreA,
      adapter: createFakeNotificationAdapter(),
      clock,
      resultStateWriter: createResultStateWriter({
        store: resultStoreA,
        writer: resultStoreA,
      }),
    });

    const outcome = await serviceA.deliverDigest({
      digest: sampleDigest(resultId),
      recipient,
      channel: 'EMAIL',
    });
    expect(outcome.kind).toBe('delivered');
    expect((await resultStoreA.getById!('profile-job', resultId))?.userState).toBe(
      'NOTIFIED'
    );

    resultStoreA.close();
    notificationStoreA.close();

    const resultStoreB = createSqliteResultPersistence({
      databasePath: persistence.resultsDatabasePath,
    });
    try {
      const loaded = await resultStoreB.getById!('profile-job', resultId);
      expect(loaded?.userState).toBe('NOTIFIED');
      expect(loaded?.id).toBe(resultId);
      expect(resultStoreB.count()).toBe(1);
    } finally {
      resultStoreB.close();
      persistence.cleanup();
    }
  });
});
