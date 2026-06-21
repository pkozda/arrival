import { expect } from 'vitest';
import { buildEconomicRealityPlan, ECONOMIC_FIXTURES } from '@arrival-atlas/modules/economic-reality';
import type { EconomicPresentationV1 } from '@/lib/product-contract';
import { adaptPresentationToUi } from '@/lib/economic-reality/ui-adapter';

function assertErCopyKey(key: string): void {
  expect(key.startsWith('ER.')).toBe(true);
}

export const E2E_UI_FIXED_META = {
  requestId: 'e2e_ui_request',
  generatedAt: '2026-06-21T12:00:00.000Z',
} as const;

export function buildUiJourneyPlan(fixtureId: string) {
  const fixture = ECONOMIC_FIXTURES.find((entry) => entry.id === fixtureId);
  if (!fixture) {
    throw new Error(`Missing fixture ${fixtureId}`);
  }

  return buildEconomicRealityPlan(fixture.userContext, E2E_UI_FIXED_META);
}

export function projectUiSections(presentation: EconomicPresentationV1) {
  return adaptPresentationToUi(presentation);
}

export function assertPresentationResolvableCopy(presentation: EconomicPresentationV1): void {
  for (const section of presentation.sections) {
    assertErCopyKey(section.titleKey);
    for (const card of section.cards) {
      assertErCopyKey(card.titleKey);
    }
  }

  assertErCopyKey(presentation.primaryHighlight.labelKey);
}

export function assertNoRawActionIdsInUiProjection(presentation: EconomicPresentationV1): void {
  const userVisibleKeys: string[] = [
    presentation.primaryHighlight.labelKey,
    ...presentation.sections.flatMap((section) => [
      section.titleKey,
      ...section.cards.map((card) => card.titleKey),
    ]),
  ];

  const actionRefPattern = /g[1-6]-[a-z0-9-]+:[a-z0-9-]+/i;
  for (const key of userVisibleKeys) {
    expect(key).not.toMatch(actionRefPattern);
  }
}
