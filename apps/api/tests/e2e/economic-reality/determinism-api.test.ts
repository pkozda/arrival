import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ECONOMIC_FIXTURES } from '@arrival-atlas/modules/economic-reality';
import { buildApp } from '../../../src/build-app.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from '../../../src/test-state.js';
import { createE2eSession, fetchE2eEconomicPlan, seedE2eUserContext } from './helpers.js';

describe('E2E API determinism regression', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  for (const fixture of ECONOMIC_FIXTURES.filter((entry) =>
    ['EF01', 'EF03', 'EF07', 'EF13'].includes(entry.id)
  )) {
    it(`${fixture.id} returns identical plan and hash across repeated GET`, async () => {
      const app = await buildApp({ logger: false });
      const sessionId = await createE2eSession(app);
      await seedE2eUserContext(sessionId, fixture.userContext);

      const first = await fetchE2eEconomicPlan(app, sessionId);
      const second = await fetchE2eEconomicPlan(app, sessionId);

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);

      if (
        typeof first.body === 'object' &&
        first.body !== null &&
        'meta' in first.body &&
        typeof second.body === 'object' &&
        second.body !== null &&
        'meta' in second.body
      ) {
        expect(second.body.meta.deterministicHash).toEqual(first.body.meta.deterministicHash);
        expect(second.body.plan).toEqual(first.body.plan);
        expect(second.body.presentation).toEqual(first.body.presentation);
      }
    });
  }
});
