import { describe, expect, it } from 'vitest';
import {
  UserProfileViewV1Schema,
  SCENARIO_FIELD_IDS,
} from '@arrival-atlas/product-contract';
import {
  buildMutationRequest,
  createLog,
  moduleSource,
  profileUiSource,
  submit,
} from './helpers.js';
import {
  getFieldValue,
  incomingMutationSupersedesIncumbent,
  projectProfileState,
  reduceProfileEvents,
  submitMutationRequest,
} from '../src/index.js';

describe('profile mutation engine invariants', () => {
  it('G1 — reducer is deterministic for shuffled input order', () => {
    const log = createLog();

    submit(
      log,
      buildMutationRequest({
        requestId: 'g1_create',
        type: 'fact.create',
        intent: 'capture',
        domain: 'income',
        source: moduleSource(),
        fields: { grossMonthlyIncome: 1000 },
      })
    );

    submit(
      log,
      buildMutationRequest({
        requestId: 'g1_update',
        type: 'fact.update',
        intent: 'capture',
        domain: 'income',
        source: moduleSource(),
        fields: { grossMonthlyIncome: 2000 },
      })
    );

    const events = log.list('prof_test');
    const ordered = reduceProfileEvents('prof_test', events);
    const reversed = reduceProfileEvents('prof_test', [...events].reverse());

    expect(reversed).toEqual(ordered);
    expect(getFieldValue(ordered, 'grossMonthlyIncome')).toBe(2000);
  });

  it('G2 — replay produces identical state', () => {
    const log = createLog();
    submit(
      log,
      buildMutationRequest({
        requestId: 'g2',
        type: 'fact.create',
        intent: 'capture',
        domain: 'housing',
        source: moduleSource(),
        fields: { city: 'Hamburg' },
      })
    );

    const events = log.list('prof_test');
    const run1 = reduceProfileEvents('prof_test', events);
    const run2 = reduceProfileEvents('prof_test', events);

    expect(run1).toEqual(run2);
  });

  it('G3 — scenario fields never enter ProfileState', () => {
    const log = createLog();
    const result = submit(
      log,
      buildMutationRequest({
        requestId: 'g3_bad',
        type: 'fact.create',
        intent: 'capture',
        domain: 'income',
        source: moduleSource(),
        fields: { [SCENARIO_FIELD_IDS[0]]: 5000 },
      })
    );

    expect(result.ok).toBe(false);
    expect(log.list('prof_test')).toHaveLength(0);
  });

  it('G4 — projection never exposes internal paths or reducer metadata', () => {
    const log = createLog();
    const committed = submit(
      log,
      buildMutationRequest({
        requestId: 'g4',
        type: 'fact.create',
        intent: 'capture',
        domain: 'income',
        source: moduleSource(),
        fields: { grossMonthlyIncome: 4100 },
      })
    );

    expect(committed.ok).toBe(true);
    if (!committed.ok) {
      return;
    }

    const parsed = UserProfileViewV1Schema.parse(committed.profileView);
    const serialized = JSON.stringify(parsed);

    expect(serialized).not.toContain('fieldDeltas');
    expect(serialized).not.toContain('setBySequence');
    expect(serialized).not.toContain('employment.');
    expect(parsed.domains.income?.grossMonthlyIncome).toBe(4100);
    expect(projectProfileState(committed.profileState)).toEqual(parsed);
  });

  it('G5 — mutations must go through coordinator validation', () => {
    const log = createLog();
    const invalid = submitMutationRequest(
      buildMutationRequest({
        requestId: 'g5',
        type: 'fact.suggest_correction',
        intent: 'correction',
        domain: 'income',
        source: profileUiSource('income'),
        fields: { grossMonthlyIncome: 100 },
      }),
      log,
      { profileId: 'prof_test' }
    );

    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.code).toBe('NOT_PERSISTENT');
    }

    expect(log.list('prof_test')).toHaveLength(0);
  });

  it('G6 — coordinator rebuilds state from events, not ProfileDocument', () => {
    const log = createLog();
    const result = submit(
      log,
      buildMutationRequest({
        requestId: 'g6',
        type: 'fact.create',
        intent: 'capture',
        domain: 'benefits',
        source: moduleSource('benefits-simulator'),
        fields: { daysInGermany: 120 },
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const fromLog = reduceProfileEvents('prof_test', log.list('prof_test'));
    expect(fromLog).toEqual(result.profileState);
    expect(getFieldValue(fromLog, 'daysInGermany')).toBe(120);
  });

  it('returns REVISION_CONFLICT for stale correction', () => {
    const log = createLog();
    submit(
      log,
      buildMutationRequest({
        requestId: 'rev_1',
        type: 'fact.create',
        intent: 'capture',
        domain: 'income',
        source: moduleSource(),
        fields: { grossMonthlyIncome: 3000 },
      })
    );

    const stale = submit(
      log,
      buildMutationRequest({
        requestId: 'rev_stale',
        type: 'fact.correct',
        intent: 'correction',
        domain: 'income',
        source: profileUiSource('income'),
        fields: { grossMonthlyIncome: 2900 },
        expectedHeadRevision: 0,
      })
    );

    expect(stale.ok).toBe(false);
    if (!stale.ok) {
      expect(stale.code).toBe('REVISION_CONFLICT');
    }
  });

  it('precedence — correction beats older module fact at commit ordering level', () => {
    expect(
      incomingMutationSupersedesIncumbent({
        incomingType: 'fact.correct',
        incomingSequence: 2,
        incumbentType: 'fact.update',
        incumbentSequence: 1,
      })
    ).toBe(true);
  });

  it('precedence — newer module execute beats older correction by sequence in reducer', () => {
    const log = createLog();
    submit(
      log,
      buildMutationRequest({
        requestId: 'p1',
        type: 'fact.create',
        intent: 'capture',
        domain: 'income',
        source: moduleSource(),
        fields: { grossMonthlyIncome: 3000 },
      })
    );

    submit(
      log,
      buildMutationRequest({
        requestId: 'p2',
        type: 'fact.correct',
        intent: 'correction',
        domain: 'income',
        source: profileUiSource('income'),
        fields: { grossMonthlyIncome: 2800 },
        expectedHeadRevision: 1,
      })
    );

    submit(
      log,
      buildMutationRequest({
        requestId: 'p3',
        type: 'fact.update',
        intent: 'capture',
        domain: 'income',
        source: { kind: 'module', moduleId: 'financial-reality', executionId: 'exec_new' },
        fields: { grossMonthlyIncome: 3300 },
      })
    );

    const state = reduceProfileEvents('prof_test', log.list('prof_test'));
    expect(getFieldValue(state, 'grossMonthlyIncome')).toBe(3300);
  });

  it('idempotent requestId returns same event without duplicate append', () => {
    const log = createLog();
    const request = buildMutationRequest({
      requestId: 'idem_1',
      type: 'fact.create',
      intent: 'capture',
      domain: 'income',
      source: moduleSource(),
      fields: { grossMonthlyIncome: 1500 },
    });

    const first = submit(log, request);
    const second = submit(log, request);

    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.event.eventId).toBe(first.event.eventId);
    }

    expect(log.list('prof_test')).toHaveLength(1);
  });
});
