import { describe, expect, it, beforeEach } from 'vitest';
import { buildEconomicRealityPlan } from '@arrival-atlas/modules/economic-reality';
import { ECONOMIC_FIXTURES } from '@arrival-atlas/modules/economic-reality';
import {
  adaptPresentationToUi,
  buildEconomicPlanCacheKey,
  clearEconomicPlanCache,
  hydrateEconomicPlan,
  readEconomicPlanCache,
  reconcileEconomicPlanState,
  writeEconomicPlanCache,
} from '@/lib/economic-reality';

const FIXED_META = {
  requestId: 'req_ep8_test',
  generatedAt: '2026-06-21T12:00:00.000Z',
};

function buildFixtureResponse(fixtureId = 'EF01') {
  const fixture = ECONOMIC_FIXTURES.find((entry) => entry.id === fixtureId)!;
  return buildEconomicRealityPlan(fixture.userContext, FIXED_META);
}

describe('hydrateEconomicPlan', () => {
  it('maps EP-7 response fields without transformation', () => {
    const response = buildFixtureResponse();
    const state = hydrateEconomicPlan(response);

    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.lastUpdated).toBe(response.meta.generatedAt);
    expect(state.deterministicHash).toBe(response.meta.deterministicHash);
    expect(state.evaluation).toEqual(response.evaluation);
    expect(state.graph).toEqual(response.graph);
    expect(state.execution).toEqual(response.execution);
    expect(state.actionSet).toEqual(response.actionSet);
    expect(state.plan).toEqual(response.plan);
    expect(state.presentation).toEqual(response.presentation);
  });
});

describe('reconcileEconomicPlanState hash guard', () => {
  beforeEach(() => {
    clearEconomicPlanCache();
  });

  it('returns the same state reference when deterministicHash is unchanged', () => {
    const response = buildFixtureResponse();
    const initial = hydrateEconomicPlan(response);
    writeEconomicPlanCache(initial);

    const reconciled = reconcileEconomicPlanState(initial, response);
    expect(reconciled).toBe(initial);
  });

  it('hydrates and caches when deterministicHash changes', () => {
    const first = hydrateEconomicPlan(buildFixtureResponse('EF01'));
    const secondResponse = buildFixtureResponse('EF02');

    const reconciled = reconcileEconomicPlanState(first, secondResponse);
    expect(reconciled.deterministicHash).toBe(secondResponse.meta.deterministicHash);
    expect(reconciled.evaluation?.economicState).toBe('employment_active');
    expect(readEconomicPlanCache(secondResponse.meta.deterministicHash)).toEqual(reconciled);
  });

  it('reuses cache entry for identical hash without recomputing hydration', () => {
    const response = buildFixtureResponse();
    const hydrated = hydrateEconomicPlan(response);
    writeEconomicPlanCache(hydrated);

    const emptyState = {
      loading: true,
      error: null,
      lastUpdated: null,
      deterministicHash: null,
    };
    const reconciled = reconcileEconomicPlanState(emptyState, response);
    expect(reconciled).toBe(hydrated);
  });
});

describe('deterministic cache', () => {
  beforeEach(() => {
    clearEconomicPlanCache();
  });

  it('keys cache entries by deterministicHash only', () => {
    const response = buildFixtureResponse();
    const state = hydrateEconomicPlan(response);
    writeEconomicPlanCache(state);

    expect(buildEconomicPlanCacheKey(response.meta.deterministicHash)).toBe(
      `economic-plan:${response.meta.deterministicHash}`
    );
    expect(readEconomicPlanCache(response.meta.deterministicHash)).toEqual(state);
  });
});

describe('adaptPresentationToUi', () => {
  it('maps presentation sections and cards 1:1 without reordering', () => {
    const response = buildFixtureResponse();
    const projection = adaptPresentationToUi(response.presentation);

    expect(projection).toHaveLength(response.presentation.sections.length);
    for (let index = 0; index < projection.length; index += 1) {
      const section = response.presentation.sections[index]!;
      const mapped = projection[index]!;

      expect(mapped.section).toBe(section);
      if (section.type === 'PRIMARY') {
        expect(mapped.panelComponent).toBe('MainActionPanel');
      }
      if (section.type === 'SECONDARY') {
        expect(mapped.panelComponent).toBe('SupportPanel');
      }
      if (section.type === 'SYSTEM') {
        expect(mapped.panelComponent).toBe('SystemPanel');
      }

      expect(mapped.cards).toHaveLength(section.cards.length);
      for (let cardIndex = 0; cardIndex < mapped.cards.length; cardIndex += 1) {
        const card = section.cards[cardIndex]!;
        const mappedCard = mapped.cards[cardIndex]!;
        expect(mappedCard.card).toBe(card);
        if (card.uiType === 'ACTION_CARD') {
          expect(mappedCard.component).toBe('ActionCard');
        }
        if (card.uiType === 'INTENT_CARD') {
          expect(mappedCard.component).toBe('IntentCard');
        }
        if (card.uiType === 'RESOURCE_CARD') {
          expect(mappedCard.component).toBe('ResourceCard');
        }
        if (card.uiType === 'PROFILE_CARD') {
          expect(mappedCard.component).toBe('ProfileCard');
        }
      }
    }
  });

  it('is deterministic for identical presentation input', () => {
    const response = buildFixtureResponse();
    const first = adaptPresentationToUi(response.presentation);
    const second = adaptPresentationToUi(response.presentation);
    expect(second).toEqual(first);
  });
});

describe('fetchEconomicPlan client contract', () => {
  it('targets the EP-7 plan endpoint only', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const source = readFileSync(join(__dirname, 'client.ts'), 'utf8');

    expect(source).toContain('/api/modules/economic-reality/plan');
    expect(source).not.toContain('buildEconomicRealityPlan');
    expect(source).not.toContain('evaluate(');
    expect(source).not.toContain('buildPlan');
  });
});

describe('useEconomicRealityPlan hook contract', () => {
  it('loads once per sessionId without refetch dependency loops', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const source = readFileSync(join(__dirname, 'useEconomicRealityPlan.tsx'), 'utf8');

    expect(source).toContain('useEffect');
    expect(source).toContain('[load]');
    expect(source).not.toContain('[state]');
    expect(source).toContain('reconcileEconomicPlanState');
    expect(source).toContain('EconomicRealityPlanProvider');
    expect(source).toContain('bindEconomicActionContext');
  });
});
