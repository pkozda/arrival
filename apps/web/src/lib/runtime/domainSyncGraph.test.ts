import { describe, expect, it } from 'vitest';
import type { UserContextV1 } from '@/lib/product-contract';
import {
  buildSyncPlan,
  DOMAIN_SYNC_GRAPH,
  mapEventToInitialDomains,
  mapSyncScopeToInitialDomains,
} from './domainSyncGraph';

const minimalUserContext = {
  schemaVersion: '1.0.0',
  profile: { language: 'en' },
} as UserContextV1;

describe('domainSyncGraph', () => {
  it('defines the expected static dependency graph', () => {
    expect(DOMAIN_SYNC_GRAPH.domains).toEqual([
      'PROFILE',
      'LIFE_EVENT',
      'ECONOMIC',
      'SNAPSHOT',
    ]);
    expect(DOMAIN_SYNC_GRAPH.edges).toEqual([
      { from: 'PROFILE', to: 'ECONOMIC', reason: 'cascade' },
      { from: 'PROFILE', to: 'LIFE_EVENT', reason: 'cascade' },
      { from: 'LIFE_EVENT', to: 'ECONOMIC', reason: 'dependency' },
      { from: 'ECONOMIC', to: 'SNAPSHOT', reason: 'recompute' },
    ]);
  });

  it('maps events to initial domains', () => {
    expect(
      mapEventToInitialDomains({
        type: 'PROFILE_MUTATED',
        revision: 1,
        userContext: minimalUserContext,
      })
    ).toEqual(['PROFILE']);

    expect(
      mapEventToInitialDomains({
        type: 'ECONOMIC_ACTION_EXECUTED',
        actionId: 'a1',
        previousDeterministicHash: 'hash-a',
        deterministicHash: 'hash-b',
        planChanged: true,
      })
    ).toEqual(['ECONOMIC']);

    expect(
      mapEventToInitialDomains({ type: 'SESSION_SYNC_REQUESTED', scope: 'PROFILE' })
    ).toEqual(['PROFILE']);
  });

  it('maps legacy sync scopes to initial domains', () => {
    expect(mapSyncScopeToInitialDomains('PROFILE')).toEqual(['PROFILE']);
    expect(mapSyncScopeToInitialDomains('ECONOMIC')).toEqual(['ECONOMIC']);
    expect(mapSyncScopeToInitialDomains('FULL')).toEqual([
      'PROFILE',
      'LIFE_EVENT',
      'ECONOMIC',
      'SNAPSHOT',
    ]);
  });

  it('builds deterministic sync plans in topological order', () => {
    expect(
      buildSyncPlan({
        type: 'PROFILE_MUTATED',
        revision: 1,
        userContext: minimalUserContext,
      })
    ).toEqual(['PROFILE', 'LIFE_EVENT', 'ECONOMIC', 'SNAPSHOT']);

    expect(
      buildSyncPlan({
        type: 'ECONOMIC_ACTION_EXECUTED',
        actionId: 'a1',
        previousDeterministicHash: 'hash-a',
        deterministicHash: 'hash-b',
        planChanged: true,
      })
    ).toEqual(['ECONOMIC', 'SNAPSHOT']);

    expect(
      buildSyncPlan({ type: 'SESSION_SYNC_REQUESTED', scope: 'PROFILE' })
    ).toEqual(['PROFILE', 'LIFE_EVENT', 'ECONOMIC', 'SNAPSHOT']);

    expect(
      buildSyncPlan({ type: 'SESSION_SYNC_REQUESTED', scope: 'ECONOMIC' })
    ).toEqual(['ECONOMIC', 'SNAPSHOT']);

    expect(buildSyncPlan({ type: 'SESSION_SYNC_REQUESTED', scope: 'FULL' })).toEqual([
      'PROFILE',
      'LIFE_EVENT',
      'ECONOMIC',
      'SNAPSHOT',
    ]);
  });

  it('produces the same plan for the same event sequence', () => {
    const event = {
      type: 'PROFILE_MUTATED' as const,
      revision: 2,
      userContext: minimalUserContext,
    };

    const first = buildSyncPlan(event);
    const second = buildSyncPlan(event);

    expect(first).toEqual(second);
    expect(first).toEqual(['PROFILE', 'LIFE_EVENT', 'ECONOMIC', 'SNAPSHOT']);
  });
});
