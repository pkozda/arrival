import { afterEach, describe, expect, it, vi } from 'vitest';
import { emit, subscribe } from './runtimeReactionBus';
import type { UserContextV1 } from '@/lib/product-contract';
import {
  buildSyncPlan,
  resetRuntimeConsistencyModelForTests,
} from './runtimeConsistencyModel';

const minimalUserContext = {
  schemaVersion: '1.0.0',
  profile: { language: 'en' },
} as UserContextV1;

describe('runtimeReactionBus', () => {
  it('delivers PROFILE_MUTATED to subscribers', () => {
    const handler = vi.fn();
    const unsubscribe = subscribe('PROFILE_MUTATED', handler);

    emit({ type: 'PROFILE_MUTATED', revision: 3, userContext: minimalUserContext });

    expect(handler).toHaveBeenCalledWith({
      type: 'PROFILE_MUTATED',
      revision: 3,
      userContext: minimalUserContext,
    });
    unsubscribe();
  });

  it('does not deliver events after unsubscribe', () => {
    const handler = vi.fn();
    const unsubscribe = subscribe('ECONOMIC_ACTION_EXECUTED', handler);
    unsubscribe();

    emit({
      type: 'ECONOMIC_ACTION_EXECUTED',
      actionId: 'a1',
      previousDeterministicHash: 'hash-a',
      deterministicHash: 'hash-b',
      planChanged: true,
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('isolates handlers by event type', () => {
    const profileHandler = vi.fn();
    const actionHandler = vi.fn();
    subscribe('PROFILE_MUTATED', profileHandler);
    subscribe('ECONOMIC_ACTION_EXECUTED', actionHandler);

    emit({
      type: 'ECONOMIC_ACTION_EXECUTED',
      actionId: 'a1',
      previousDeterministicHash: 'hash-a',
      deterministicHash: 'hash-a',
      planChanged: false,
    });

    expect(profileHandler).not.toHaveBeenCalled();
    expect(actionHandler).toHaveBeenCalledTimes(1);
  });
});

describe('runtimeConsistencyModel sync plan', () => {
  afterEach(() => {
    resetRuntimeConsistencyModelForTests();
  });

  it('builds graph-driven plans instead of flat FULL scope for profile mutations', () => {
    expect(
      buildSyncPlan({
        type: 'PROFILE_MUTATED',
        revision: 1,
        userContext: minimalUserContext,
      })
    ).toEqual(['PROFILE', 'LIFE_EVENT', 'ECONOMIC', 'SNAPSHOT']);
  });

  it('limits economic action sync to economic and snapshot domains', () => {
    expect(
      buildSyncPlan({
        type: 'ECONOMIC_ACTION_EXECUTED',
        actionId: 'a1',
        previousDeterministicHash: 'hash-a',
        deterministicHash: 'hash-b',
        planChanged: true,
      })
    ).toEqual(['ECONOMIC', 'SNAPSHOT']);
  });
});
