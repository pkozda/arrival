import { describe, expect, it } from 'vitest';
import {
  assertNoRawActionIdsInUiProjection,
  assertPresentationResolvableCopy,
  buildUiJourneyPlan,
  projectUiSections,
} from './helpers.js';

describe('E2E Scenario B — UI rendering: stabilized institution path', () => {
  it('renders PRIMARY + SECONDARY with ProfileCard and no crisis IntentCard', () => {
    const response = buildUiJourneyPlan('EF13');
    const sections = projectUiSections(response.presentation);

    expect(sections.some((entry) => entry.section.type === 'PRIMARY')).toBe(true);
    expect(sections.some((entry) => entry.section.type === 'SECONDARY')).toBe(true);

    const profileCards = sections
      .flatMap((entry) => entry.cards)
      .filter((entry) => entry.component === 'ProfileCard');
    expect(profileCards.length).toBeGreaterThan(0);

    const crisisIntentCards = sections
      .flatMap((entry) => entry.cards)
      .filter(
        (entry) =>
          entry.component === 'IntentCard' &&
          entry.card.actionRefIds.some((actionId) => actionId.includes('initiate-benefit'))
      );
    expect(crisisIntentCards).toHaveLength(0);

    const systemPanel = sections.find((entry) => entry.panelComponent === 'SystemPanel');
    expect(systemPanel?.cards.length ?? 0).toBeLessThanOrEqual(1);

    assertPresentationResolvableCopy(response.presentation);
    assertNoRawActionIdsInUiProjection(response.presentation);
  });
});
