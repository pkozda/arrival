import { describe, expect, it, beforeEach } from 'vitest';
import {
  processModuleRuntimeEvent,
  resetRuntimeSessionState,
} from './runtime-engine';
import { resolveExecutionEffect } from './effect-resolver';
import type { ModuleRuntimeEventV1 } from './types';

const OCCURRED_AT = '2026-06-20T12:00:00.000Z';

function event(
  overrides: Partial<ModuleRuntimeEventV1> & { execution: ModuleRuntimeEventV1['execution'] }
): ModuleRuntimeEventV1 {
  return {
    type: 'action_executed',
    occurredAt: OCCURRED_AT,
    ...overrides,
  };
}

describe('processModuleRuntimeEvent (LE-8)', () => {
  beforeEach(() => {
    resetRuntimeSessionState();
  });

  it('maps success to completedActions deterministically', () => {
    const input = event({
      execution: {
        actionId: 'g1-registration',
        moduleId: 'life-event',
        status: 'success',
      },
    });

    const first = processModuleRuntimeEvent(input);
    const second = processModuleRuntimeEvent(input);

    expect(first).toEqual(second);
    expect(first.completedActions).toEqual(['g1-registration']);
    expect(first.failedActions).toEqual([]);
  });

  it('maps failure to failedActions', () => {
    const effect = processModuleRuntimeEvent(
      event({
        execution: {
          actionId: 'insurance-step',
          moduleId: 'healthcare-navigation',
          status: 'failed',
        },
      })
    );

    expect(effect.failedActions).toEqual(['insurance-step']);
    expect(effect.moduleMutations[0]?.mutationType).toBe('failed');
  });

  it('isolates module handler overlays without cross-module bleed', () => {
    const effect = processModuleRuntimeEvent(
      event({
        execution: {
          actionId: 'grocery-action',
          moduleId: 'grocery-optimization',
          status: 'success',
        },
      })
    );

    expect(effect.completedActions).toEqual(['grocery-action']);
    expect(effect.stateSignals.every((signal) => signal.sourceModuleId === 'grocery-optimization')).toBe(
      true
    );
  });

  it('resolveExecutionEffect is pure for the same event', () => {
    const runtimeEvent = event({
      execution: {
        actionId: 'action-1',
        moduleId: 'financial-reality',
        status: 'partial',
      },
    });

    expect(resolveExecutionEffect(runtimeEvent)).toEqual(resolveExecutionEffect(runtimeEvent));
  });
});
