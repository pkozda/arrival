import { describe, expect, it } from 'vitest';
import {
  assertNoRawActionIdsInUiProjection,
  assertPresentationResolvableCopy,
  buildUiJourneyPlan,
  projectUiSections,
} from './helpers.js';

describe('E2E Scenario A — UI rendering: crisis onboarding path', () => {
  it('renders PRIMARY + SYSTEM with IntentCard mapping and copy keys only', () => {
    const response = buildUiJourneyPlan('EF07');
    const sections = projectUiSections(response.presentation);

    expect(sections.map((entry) => entry.section.type)).toEqual(
      expect.arrayContaining(['PRIMARY', 'SYSTEM'])
    );

    const intentCards = sections
      .flatMap((entry) => entry.cards)
      .filter((entry) => entry.component === 'IntentCard');
    expect(intentCards.length).toBeGreaterThan(0);

    const resourceCards = sections
      .flatMap((entry) => entry.cards)
      .filter((entry) => entry.component === 'ResourceCard');
    expect(resourceCards.length).toBeGreaterThan(0);

    assertPresentationResolvableCopy(response.presentation);
    assertNoRawActionIdsInUiProjection(response.presentation);
  });
});
