import type {
  EconomicPresentationV1,
  PresentationCardV1,
  PresentationSectionType,
} from '@/lib/product-contract';
import type { EconomicUiSectionProjection } from '@/lib/economic-reality';
import {
  layoutGalaxyGraphNodes,
  type GalaxyNodeState,
  type SpatialGraphEdge,
} from '@/lib/presentation/spatial-core';

export type EconomicGalaxyNodePayload = {
  card: PresentationCardV1;
  sectionType: PresentationSectionType;
  sectionTitleKey: string;
};

type BuildInput = {
  presentation: EconomicPresentationV1;
  sections: EconomicUiSectionProjection[];
};

function cardMatchesPrimaryFocus(card: PresentationCardV1, presentation: EconomicPresentationV1): boolean {
  const dominant = new Set(presentation.primaryHighlight.dominantActionRefIds);
  return card.actionRefIds.some((actionId) => dominant.has(actionId));
}

function cardStatus(
  card: PresentationCardV1,
  sectionType: PresentationSectionType,
  isPrimaryFocus: boolean
): GalaxyNodeState {
  if (isPrimaryFocus) {
    return 'recommended';
  }
  if (card.uiType === 'PROFILE_CARD' && card.severity === 'high') {
    return 'blocked';
  }
  if (sectionType === 'SYSTEM') {
    return 'future';
  }
  if (sectionType === 'SECONDARY') {
    return 'recommended';
  }
  return 'recommended';
}

function collectCards(sections: EconomicUiSectionProjection[]) {
  return sections.flatMap((section) =>
    section.cards.map((entry) => ({
      card: entry.card,
      sectionType: section.section.type,
      sectionTitleKey: section.section.titleKey,
    }))
  );
}

export function buildEconomicRealityGalaxyGraph({ presentation, sections }: BuildInput) {
  const cards = collectCards(sections);
  const primaryFocusCard =
    cards.find((entry) => cardMatchesPrimaryFocus(entry.card, presentation)) ??
    cards.find((entry) => entry.sectionType === 'PRIMARY') ??
    null;

  const blocked = cards.filter(
    (entry) =>
      entry.card.uiType === 'PROFILE_CARD' &&
      entry.card.severity === 'high' &&
      entry.card.cardId !== primaryFocusCard?.card.cardId
  );

  const secondary = cards.filter(
    (entry) =>
      entry.sectionType === 'SECONDARY' ||
      (entry.sectionType === 'PRIMARY' && entry.card.cardId !== primaryFocusCard?.card.cardId)
  );

  const contextual = cards.filter((entry) => entry.sectionType === 'SYSTEM');

  const toLayoutNode = (
    entry: (typeof cards)[number],
    status: GalaxyNodeState
  ) => ({
    id: entry.card.cardId,
    status,
    payload: {
      card: entry.card,
      sectionType: entry.sectionType,
      sectionTitleKey: entry.sectionTitleKey,
    } satisfies EconomicGalaxyNodePayload,
  });

  const graphNodes = layoutGalaxyGraphNodes<EconomicGalaxyNodePayload>({
    primary: primaryFocusCard
      ? toLayoutNode(
          primaryFocusCard,
          cardStatus(
            primaryFocusCard.card,
            primaryFocusCard.sectionType,
            true
          )
        )
      : undefined,
    blocked: blocked.map((entry) => toLayoutNode(entry, 'blocked')),
    completed: [],
    secondary: secondary.map((entry) =>
      toLayoutNode(entry, cardStatus(entry.card, entry.sectionType, false))
    ),
    contextual: contextual.map((entry) => toLayoutNode(entry, 'future')),
  });

  const graphEdges: SpatialGraphEdge[] = [];
  const focusId = primaryFocusCard?.card.cardId;

  if (focusId) {
    graphEdges.push({ id: `unlock-journey-${focusId}`, from: '__journey__', to: focusId, type: 'unlock' });
    secondary.forEach((entry) => {
      graphEdges.push({
        id: `unlock-${focusId}-${entry.card.cardId}`,
        from: focusId,
        to: entry.card.cardId,
        type: 'unlock',
      });
    });
    contextual.forEach((entry) => {
      graphEdges.push({
        id: `unlock-${focusId}-${entry.card.cardId}`,
        from: focusId,
        to: entry.card.cardId,
        type: 'unlock',
      });
    });
    blocked.forEach((entry) => {
      graphEdges.push({
        id: `dep-${entry.card.cardId}-${focusId}`,
        from: entry.card.cardId,
        to: focusId,
        type: 'dependency',
      });
    });
  } else if (secondary[0]) {
    const anchorId = secondary[0].card.cardId;
    graphEdges.push({ id: `unlock-journey-${anchorId}`, from: '__journey__', to: anchorId, type: 'unlock' });
  }

  return {
    graphNodes,
    graphEdges,
    primaryFocusCardId: focusId ?? null,
    journeyLabelKey: presentation.primaryHighlight.labelKey,
  };
}
