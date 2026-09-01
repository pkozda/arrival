import {
  emptyCriteria,
  resultIdentityKey,
  type DiscoveryProfile,
  type DiscoveryResult,
  type ProfileStore,
  type RunStore,
} from '@arrival-atlas/discovery';
import type { SqliteResultPersistence } from '@arrival-atlas/discovery';

const PROFILE_ID = 'profile-e2e-jobs';
const NOW = '2026-09-01T10:00:00.000Z';
const UPDATED_AT = '2026-09-01T11:00:00.000Z';

function buildProfile(userId: string): DiscoveryProfile {
  return {
    id: PROFILE_ID,
    userId,
    name: 'E2E Jobs',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    criteria: {
      ...emptyCriteria(),
      required: [{ key: 'country', value: 'DE' }],
      preferred: [{ key: 'role', value: 'Engineer' }],
    },
    schedule: { cadence: 'manual' },
    notification: { emailEnabled: true, skipEmptyDigest: true },
    enabled: true,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function buildResult(
  overrides: Partial<DiscoveryResult> & { idSuffix: string }
): DiscoveryResult {
  const identity = {
    externalIds: { url: `https://employer.example/jobs/${overrides.idSuffix}` },
    canonicalUrl: `https://employer.example/jobs/${overrides.idSuffix}`,
    fingerprintMaterial: {
      title: overrides.canonicalPresentation?.title ?? 'Frontend Engineer',
      company: 'Acme',
    },
  };
  const fields = ['title', 'company'] as const;
  const base: DiscoveryResult = {
    id: `result:${PROFILE_ID}:${resultIdentityKey(identity, fields)}`,
    profileId: PROFILE_ID,
    strategyId: 'job-discovery',
    strategyVersion: '1',
    identity,
    canonicalPresentation: {
      title: 'Frontend Engineer',
      summary: 'Great role for E2E',
      primaryUrl: identity.canonicalUrl,
    },
    source: { trust: 'AGGREGATOR', url: identity.canonicalUrl! },
    verification: {
      status: 'PASS',
      sourceTrust: 'OFFICIAL',
      freshness: 'CURRENT',
      checks: [
        { id: 'official_source', outcome: 'TRUE', required: true, evidenceIds: ['ev-1'] },
      ],
      evidenceIds: ['ev-1'],
      verifiedAt: NOW,
    },
    evidence: [
      {
        id: 'ev-1',
        type: 'OFFICIAL_SOURCE',
        sourceUrl: identity.canonicalUrl!,
        statement: 'We are hiring engineers',
        capturedAt: NOW,
      },
    ],
    score: {
      matchScore: 0.9,
      confidenceScore: 0.85,
      breakdown: {
        dimensions: [
          { id: 'role', labelKey: 'discovery.score.role', value: 80, weight: 0.3 },
        ],
      },
      scoredAt: NOW,
      strategyVersion: '1',
    },
    lifecycle: 'ACTIVE',
    userState: 'NEW',
    firstSeenAt: NOW,
    lastVerifiedAt: NOW,
    lastChangedAt: NOW,
    materialFields: {},
  };

  return {
    ...base,
    ...overrides,
    id: overrides.id ?? base.id,
    identity: overrides.identity ?? base.identity,
    canonicalPresentation: overrides.canonicalPresentation ?? base.canonicalPresentation,
  };
}

export async function seedDiscoveryE2eFixture(opts: {
  userId: string;
  profileStore: ProfileStore;
  resultStore: SqliteResultPersistence;
  runStore: RunStore;
}): Promise<{ profileId: string; resultIds: string[] }> {
  const profile = buildProfile(opts.userId);
  await opts.profileStore.upsert(profile);

  const newResult = buildResult({ idSuffix: 'new' });
  const updatedIdentity = {
    externalIds: { url: 'https://employer.example/jobs/updated' },
    canonicalUrl: 'https://employer.example/jobs/updated',
    fingerprintMaterial: { title: 'Backend Engineer', company: 'Beta Corp' },
  };
  const updatedResult = buildResult({
    idSuffix: 'updated',
    identity: updatedIdentity,
    canonicalPresentation: {
      title: 'Backend Engineer',
      summary: 'Updated listing',
      primaryUrl: 'https://employer.example/jobs/updated',
    },
    userState: 'SEEN',
    firstSeenAt: NOW,
    lastChangedAt: UPDATED_AT,
    id: `result:${PROFILE_ID}:${resultIdentityKey(updatedIdentity, ['title', 'company'])}`,
  });

  for (const result of [newResult, updatedResult]) {
    const existing = await opts.resultStore.getById(PROFILE_ID, result.id);
    if (!existing) {
      await opts.resultStore.create(result);
    } else {
      await opts.resultStore.update(result);
    }
  }

  const runId = 'run-e2e-1';
  const existingRun = await opts.runStore.get(runId);
  if (!existingRun) {
    await opts.runStore.insert({
      runId,
      scheduleId: 'sched-e2e-1',
      profileId: PROFILE_ID,
      trigger: 'scheduled',
      startedAt: NOW,
      finishedAt: UPDATED_AT,
      status: 'SUCCESS',
    });
  }

  return {
    profileId: PROFILE_ID,
    resultIds: [newResult.id, updatedResult.id],
  };
}
