import { describe, it, expect } from 'vitest';
import {
  TraceCollector,
  aggregateTraceSteps,
  sortStepsByField,
} from './trace-collector.js';

describe('TraceCollector', () => {
  it('records steps in order and builds an execution trace', () => {
    const collector = new TraceCollector();
    collector.record({ type: 'PROFILE_LOADED', profileId: 'prof_1' });
    collector.record({ type: 'POLICY_APPLIED', policyId: 'financial-reality' });
    collector.record({ type: 'FIELD_ALLOWED', field: 'employment' });
    collector.record({ type: 'MERGE_DECISION', field: 'grossIncome', source: 'profile' });
    collector.record({ type: 'FINAL_VALUE', field: 'grossIncome', value: 2500 });

    const trace = collector.build({
      sessionId: 'sess_1',
      moduleId: 'financial-reality',
    });

    expect(trace).toEqual({
      sessionId: 'sess_1',
      moduleId: 'financial-reality',
      steps: [
        { type: 'PROFILE_LOADED', profileId: 'prof_1' },
        { type: 'POLICY_APPLIED', policyId: 'financial-reality' },
        { type: 'FIELD_ALLOWED', field: 'employment' },
        { type: 'MERGE_DECISION', field: 'grossIncome', source: 'profile' },
        { type: 'FINAL_VALUE', field: 'grossIncome', value: 2500 },
      ],
    });
  });

  it('aggregates segments in deterministic order', () => {
    const policySteps = [
      { type: 'POLICY_APPLIED' as const, policyId: 'financial-reality' },
      { type: 'FIELD_ALLOWED' as const, field: 'housing' },
      { type: 'FIELD_ALLOWED' as const, field: 'employment' },
    ];
    const mergeSteps = [
      { type: 'MERGE_DECISION' as const, field: 'grossIncome', source: 'profile' as const },
      { type: 'FINAL_VALUE' as const, field: 'grossIncome', value: 2500 },
    ];

    expect(aggregateTraceSteps(policySteps, mergeSteps)).toEqual([
      ...policySteps,
      ...mergeSteps,
    ]);
  });

  it('sorts field steps deterministically within a segment', () => {
    const steps = [
      { type: 'FIELD_REDACTED' as const, field: 'housing.monthlyColdRent' },
      { type: 'FIELD_REDACTED' as const, field: 'employment.grossMonthlyIncome' },
      { type: 'POLICY_APPLIED' as const, policyId: 'financial-reality' },
    ];

    expect(sortStepsByField(steps, ['FIELD_REDACTED'])).toEqual([
      { type: 'POLICY_APPLIED', policyId: 'financial-reality' },
      { type: 'FIELD_REDACTED', field: 'employment.grossMonthlyIncome' },
      { type: 'FIELD_REDACTED', field: 'housing.monthlyColdRent' },
    ]);
  });
});
