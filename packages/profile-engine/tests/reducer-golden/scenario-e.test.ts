import { describe, expect, it } from 'vitest';
import {
  buildEvent,
  moduleSource,
  profileUiSource,
  stateFromEvents,
  TEST_PROFILE_ID,
} from '../helpers.js';
import { reduceProfileEvents } from '../../src/index.js';

describe('golden scenario E — full event log replay', () => {
  const events = [
    buildEvent({
      sequence: 1,
      revision: 1,
      type: 'fact.create',
      intent: 'capture',
      domain: 'migration',
      source: moduleSource('life-event'),
      fieldDeltas: [
        { fieldId: 'countryOfOrigin', before: null, after: 'UA', operation: 'set' },
      ],
    }),
    buildEvent({
      sequence: 2,
      revision: 2,
      type: 'fact.create',
      intent: 'capture',
      domain: 'housing',
      source: moduleSource(),
      mutationId: 'req_housing',
      fieldDeltas: [
        { fieldId: 'city', before: null, after: 'Berlin', operation: 'set' },
        { fieldId: 'monthlyColdRent', before: null, after: 850, operation: 'set' },
      ],
    }),
    buildEvent({
      sequence: 3,
      revision: 3,
      type: 'fact.correct',
      intent: 'correction',
      domain: 'housing',
      source: profileUiSource('housing'),
      mutationId: 'req_rent_fix',
      fieldDeltas: [
        { fieldId: 'monthlyColdRent', before: 850, after: 900, operation: 'set' },
      ],
    }),
    buildEvent({
      sequence: 4,
      revision: 4,
      type: 'fact.update',
      intent: 'capture',
      domain: 'income',
      source: moduleSource(),
      mutationId: 'req_income',
      fieldDeltas: [
        { fieldId: 'grossMonthlyIncome', before: null, after: 3200, operation: 'set' },
      ],
    }),
  ];

  it('produces identical ProfileState on every replay', () => {
    const first = stateFromEvents(events);
    const second = reduceProfileEvents(TEST_PROFILE_ID, [...events]);
    const shuffled = reduceProfileEvents(
      TEST_PROFILE_ID,
      [...events].sort((a, b) => b.sequence - a.sequence)
    );

    expect(second).toEqual(first);
    expect(shuffled).toEqual(first);
    expect(first.headRevision).toBe(4);
    expect(first.lastSequence).toBe(4);
  });
});
