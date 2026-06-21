import type {
  EconomicPlanV1,
  PresentationSectionV1,
  UiStrategy,
} from '@arrival-atlas/product-contract';
import { buildCardsFromActions } from './card-builder.js';
import { SECTION_TITLE_KEYS } from './types.js';

export function buildSections(plan: EconomicPlanV1, uiStrategy: UiStrategy): PresentationSectionV1[] {
  const sections: PresentationSectionV1[] = [
    {
      sectionId: 'primary',
      titleKey: SECTION_TITLE_KEYS.PRIMARY,
      type: 'PRIMARY',
      priority: plan.primaryTrack.priority,
      cards: buildCardsFromActions({
        actions: plan.primaryTrack.actions,
        sourceTrack: 'primary',
        uiStrategy,
      }),
    },
  ];

  if (plan.secondaryTrack && plan.secondaryTrack.actions.length > 0) {
    sections.push({
      sectionId: 'secondary',
      titleKey: SECTION_TITLE_KEYS.SECONDARY,
      type: 'SECONDARY',
      priority: plan.secondaryTrack.priority,
      cards: buildCardsFromActions({
        actions: plan.secondaryTrack.actions,
        sourceTrack: 'secondary',
        uiStrategy,
      }),
    });
  }

  sections.push({
    sectionId: 'system',
    titleKey: SECTION_TITLE_KEYS.SYSTEM,
    type: 'SYSTEM',
    priority: plan.systemTrack.priority,
    cards: buildCardsFromActions({
      actions: plan.systemTrack.actions,
      sourceTrack: 'system',
      uiStrategy,
    }),
  });

  return sections;
}
