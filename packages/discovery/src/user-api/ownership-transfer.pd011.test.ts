import { describe, expect, it } from 'vitest';
import {
  createInMemoryProfileStore,
  emptyCriteria,
  transferDiscoveryProfileOwnership,
  type DiscoveryProfile,
} from '../index.js';

const NOW = '2026-09-08T12:00:00.000Z';

function profile(
  partial: Partial<DiscoveryProfile> & Pick<DiscoveryProfile, 'id' | 'userId'>
): DiscoveryProfile {
  return {
    name: 'Jobs',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    criteria: emptyCriteria(),
    schedule: { cadence: 'daily', hourUtc: 6 },
    notification: { emailEnabled: true, skipEmptyDigest: true },
    enabled: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  };
}

describe('PD-011 ownership transfer', () => {
  it('E/H/I/L — transfers session profiles to account preserving id and schedule', async () => {
    const store = createInMemoryProfileStore([
      profile({ id: 'p1', userId: 'sess_a', name: 'Session Jobs' }),
    ]);
    const result = await transferDiscoveryProfileOwnership({
      profileStore: store,
      fromUserId: 'sess_a',
      toUserId: 'acct_a',
      now: '2026-09-08T13:00:00.000Z',
    });
    expect(result.transferredProfileIds).toEqual(['p1']);
    const moved = await store.get('p1');
    expect(moved?.userId).toBe('acct_a');
    expect(moved?.schedule).toEqual({ cadence: 'daily', hourUtc: 6 });
    expect(moved?.notification.emailEnabled).toBe(true);
    expect(moved?.id).toBe('p1');
    expect(await store.listByUserId('sess_a')).toHaveLength(0);
    expect(await store.listByUserId('acct_a')).toHaveLength(1);
  });

  it('F/G — repeated transfer is idempotent and does not duplicate', async () => {
    const store = createInMemoryProfileStore([
      profile({ id: 'p1', userId: 'sess_a' }),
    ]);
    await transferDiscoveryProfileOwnership({
      profileStore: store,
      fromUserId: 'sess_a',
      toUserId: 'acct_a',
    });
    const second = await transferDiscoveryProfileOwnership({
      profileStore: store,
      fromUserId: 'sess_a',
      toUserId: 'acct_a',
    });
    expect(second.transferredProfileIds).toEqual([]);
    expect(await store.listByUserId('acct_a')).toHaveLength(1);
    expect(await store.listByUserId('sess_a')).toHaveLength(0);
  });

  it('Q — does not transfer foreign session profiles', async () => {
    const store = createInMemoryProfileStore([
      profile({ id: 'p-foreign', userId: 'sess_b' }),
      profile({ id: 'p-mine', userId: 'sess_a' }),
    ]);
    const result = await transferDiscoveryProfileOwnership({
      profileStore: store,
      fromUserId: 'sess_a',
      toUserId: 'acct_a',
    });
    expect(result.transferredProfileIds).toEqual(['p-mine']);
    expect((await store.get('p-foreign'))?.userId).toBe('sess_b');
  });
});
