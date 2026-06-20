import { describe, expect, it } from 'vitest';
import { generateCrossModuleSignals } from './cross-module-signal-engine';
import type { ModuleRuntimeEventV1 } from './types';

function event(
  execution: ModuleRuntimeEventV1['execution']
): ModuleRuntimeEventV1 {
  return {
    type: 'action_executed',
    occurredAt: '2026-06-20T12:00:00.000Z',
    execution,
  };
}

describe('generateCrossModuleSignals (LE-8)', () => {
  it('housing completion unlocks benefits module hint', () => {
    const signals = generateCrossModuleSignals(
      event({
        actionId: 'housing-update',
        moduleId: 'financial-reality',
        status: 'success',
        metadata: { domain: 'housing' },
      })
    );

    expect(signals.some((signal) => signal.signalType === 'dependency_unlocked')).toBe(true);
    expect(signals.some((signal) => signal.targetModuleId === 'benefits-simulator')).toBe(true);
  });

  it('insurance failure emits regression and economic pressure signal', () => {
    const signals = generateCrossModuleSignals(
      event({
        actionId: 'insurance-enroll',
        moduleId: 'healthcare-navigation',
        status: 'failed',
        metadata: { domain: 'insurance' },
      })
    );

    expect(signals.some((signal) => signal.signalType === 'regression_detected')).toBe(true);
    expect(signals.some((signal) => signal.targetModuleId === 'financial-reality')).toBe(true);
  });

  it('job completion emits stabilization hint', () => {
    const signals = generateCrossModuleSignals(
      event({
        actionId: 'income-update',
        moduleId: 'financial-reality',
        status: 'success',
        metadata: { domain: 'employment' },
      })
    );

    expect(signals.some((signal) => signal.signalType === 'stabilization_hint')).toBe(true);
  });

  it('produces deterministic ordering', () => {
    const input = event({
      actionId: 'housing-update',
      moduleId: 'financial-reality',
      status: 'success',
      metadata: { domain: 'housing' },
    });

    expect(generateCrossModuleSignals(input)).toEqual(generateCrossModuleSignals(input));
  });

  it('marks all signals advisory only', () => {
    const signals = generateCrossModuleSignals(
      event({
        actionId: 'any',
        moduleId: 'life-event',
        status: 'success',
      })
    );

    expect(signals.every((signal) => signal.advisoryOnly === true)).toBe(true);
  });
});
