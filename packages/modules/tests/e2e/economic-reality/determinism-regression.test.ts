import { describe, expect, it } from 'vitest';
import { ECONOMIC_FIXTURES } from '../../../src/economic-reality/fixtures.js';
import { assertDeterministicReplay, economicFixture } from './helpers.js';

const JOURNEY_FIXTURE_IDS = ['EF01', 'EF03', 'EF07', 'EF13'] as const;

describe('E2E determinism regression (modules)', () => {
  for (const fixtureId of JOURNEY_FIXTURE_IDS) {
    it(`${fixtureId} produces identical hash and plan on replay`, () => {
      assertDeterministicReplay(economicFixture(fixtureId).userContext);
    });
  }

  it('hash stability holds across full EF catalog', () => {
    for (const fixture of ECONOMIC_FIXTURES) {
      const first = assertDeterministicReplay(fixture.userContext);
      expect(first.meta.deterministicHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});
