import type {
  EconomicActionV1,
  PresentationCardV1,
  PresentationSeverity,
  PresentationSourceTrack,
  UiStrategy,
} from '@arrival-atlas/product-contract';
import { isInstitutionIntent, resolveIntentUiType } from './intent-ui-mapper.js';

function resolveActionUiType(action: EconomicActionV1): PresentationCardV1['uiType'] {
  if (action.payload.systemIntent) {
    return resolveIntentUiType(action.payload.systemIntent);
  }

  switch (action.type) {
    case 'system_intent':
      return 'INTENT_CARD';
    case 'update_profile':
      return 'PROFILE_CARD';
    case 'open_module':
      return 'ACTION_CARD';
    case 'external_resource':
      return 'RESOURCE_CARD';
    default: {
      const exhaustive: never = action.type;
      throw new Error(`Unknown action type: ${exhaustive}`);
    }
  }
}

function resolveSeverity(
  action: EconomicActionV1,
  uiType: PresentationCardV1['uiType'],
  uiStrategy: UiStrategy
): PresentationSeverity | undefined {
  if (uiStrategy === 'CRISIS_UI' && action.type === 'system_intent') {
    return 'high';
  }

  if (
    uiStrategy === 'INSTITUTION_UI' &&
    action.type === 'system_intent' &&
    isInstitutionIntent(action.payload.systemIntent)
  ) {
    return 'high';
  }

  if (uiType === 'RESOURCE_CARD') {
    return 'low';
  }

  return 'medium';
}

function groupingKey(action: EconomicActionV1, uiType: PresentationCardV1['uiType']): string {
  return `${action.sourceNodeId}:${uiType}`;
}

export function buildCardsFromActions(input: {
  actions: EconomicActionV1[];
  sourceTrack: PresentationSourceTrack;
  uiStrategy: UiStrategy;
}): PresentationCardV1[] {
  const groups = new Map<string, EconomicActionV1[]>();

  for (const action of input.actions) {
    const uiType = resolveActionUiType(action);
    const key = groupingKey(action, uiType);
    const bucket = groups.get(key) ?? [];
    bucket.push(action);
    groups.set(key, bucket);
  }

  const cards: PresentationCardV1[] = [];

  for (const [key, groupedActions] of groups) {
    const uiType = resolveActionUiType(groupedActions[0]!);
    const [sourceNodeId] = key.split(':');

    cards.push({
      cardId: `${input.sourceTrack}:${sourceNodeId}:${uiType}`,
      titleKey: groupedActions[0]!.labelKey,
      actionRefIds: groupedActions.map((action) => action.id),
      uiType,
      severity: resolveSeverity(groupedActions[0]!, uiType, input.uiStrategy),
      sourceTrack: input.sourceTrack,
    });
  }

  return cards.sort((left, right) => {
    const leftIndex = input.actions.findIndex((action) => action.id === left.actionRefIds[0]);
    const rightIndex = input.actions.findIndex((action) => action.id === right.actionRefIds[0]);
    return leftIndex - rightIndex;
  });
}

export function collectActionRefIds(cards: PresentationCardV1[]): string[] {
  return cards.flatMap((card) => card.actionRefIds);
}
