import type {
  EconomicActionSetV1,
  EconomicPlanV1,
  EconomicPresentationV1,
  PresentationFocusV1,
  PresentationSectionV1,
} from '@arrival-atlas/product-contract';
import { ER_COPY_KEYS } from '@arrival-atlas/product-contract';
import {
  validateActionSetCopyKeys,
  validateNoRawStringsInPresentation,
  validatePresentationCopyKeys,
} from '../../i18n/copy-validation.js';
import { buildSections } from './section-builder.js';
import { resolvePresentationUiStrategy } from './ui-strategy-resolver.js';
import { crisisHighlightKey, intentFocusKey } from './intent-ui-mapper.js';

const ECONOMIC_PRESENTATION_SCHEMA_VERSION = '1.0.0' as const;

function findSection(sections: PresentationSectionV1[], type: PresentationSectionV1['type']) {
  return sections.find((section) => section.type === type);
}

function buildPrimaryHighlight(
  plan: EconomicPlanV1,
  primarySection: PresentationSectionV1 | undefined
): PresentationFocusV1 {
  const firstCard = primarySection?.cards[0];
  if (firstCard) {
    return {
      labelKey: firstCard.titleKey,
      dominantActionRefIds: [...firstCard.actionRefIds],
    };
  }

  const firstAction = plan.primaryTrack.actions[0];
  return {
    labelKey: firstAction?.labelKey ?? ER_COPY_KEYS.HIGHLIGHT_PRIMARY_PATH,
    dominantActionRefIds: firstAction ? [firstAction.id] : ['none'],
  };
}

function buildSystemHighlights(
  plan: EconomicPlanV1,
  systemSection: PresentationSectionV1 | undefined,
  uiStrategy: EconomicPresentationV1['uiStrategy']
): PresentationFocusV1[] {
  if (!systemSection || systemSection.cards.length === 0) {
    if (uiStrategy === 'INSTITUTION_UI') {
      const intentActions = plan.primaryTrack.actions.filter((action) => action.type === 'system_intent');
      if (intentActions.length > 0) {
        const intent = intentActions[0]!.payload.systemIntent;
        return [
          {
            labelKey: intent
              ? intentFocusKey(intent)
              : intentActions[0]!.labelKey,
            dominantActionRefIds: intentActions.map((action) => action.id),
          },
        ];
      }
    }

    if (uiStrategy === 'CRISIS_UI') {
      return [
        {
          labelKey: crisisHighlightKey(),
          dominantActionRefIds: plan.primaryTrack.actions.slice(0, 1).map((action) => action.id),
        },
      ];
    }

    return [];
  }

  return systemSection.cards.map((card) => ({
    labelKey: card.titleKey,
    dominantActionRefIds: [...card.actionRefIds],
  }));
}

export function buildPresentation(
  plan: EconomicPlanV1,
  actionSet: EconomicActionSetV1
): EconomicPresentationV1 {
  validateActionSetCopyKeys(actionSet);

  const uiStrategy = resolvePresentationUiStrategy(plan.orderingStrategy);
  const sections = buildSections(plan, uiStrategy);
  const primarySection = findSection(sections, 'PRIMARY');
  const systemSection = findSection(sections, 'SYSTEM');

  const presentation: EconomicPresentationV1 = {
    schemaVersion: ECONOMIC_PRESENTATION_SCHEMA_VERSION,
    presentationId: `${plan.planId}::presentation`,
    graphId: plan.graphId,
    sections,
    primaryHighlight: buildPrimaryHighlight(plan, primarySection),
    systemHighlights: buildSystemHighlights(plan, systemSection, uiStrategy),
    uiStrategy,
    metadata: {
      generatedFromPlanId: plan.planId,
    },
  };

  validatePresentationCopyKeys(presentation);
  validateNoRawStringsInPresentation(presentation);

  return presentation;
}
