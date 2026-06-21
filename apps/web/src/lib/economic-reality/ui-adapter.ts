import type {
  EconomicPresentationV1,
  PresentationCardV1,
  PresentationSectionType,
  PresentationSectionV1,
  PresentationUiType,
} from '@/lib/product-contract';

export type EconomicUiPanelComponent = 'MainActionPanel' | 'SupportPanel' | 'SystemPanel';

export type EconomicUiCardComponent =
  | 'ActionCard'
  | 'IntentCard'
  | 'ResourceCard'
  | 'ProfileCard';

export type EconomicUiCardProjection = {
  component: EconomicUiCardComponent;
  card: PresentationCardV1;
};

export type EconomicUiSectionProjection = {
  panelComponent: EconomicUiPanelComponent;
  section: PresentationSectionV1;
  cards: EconomicUiCardProjection[];
};

const SECTION_PANEL_MAP: Record<PresentationSectionType, EconomicUiPanelComponent> = {
  PRIMARY: 'MainActionPanel',
  SECONDARY: 'SupportPanel',
  SYSTEM: 'SystemPanel',
};

const CARD_COMPONENT_MAP: Record<PresentationUiType, EconomicUiCardComponent> = {
  ACTION_CARD: 'ActionCard',
  INTENT_CARD: 'IntentCard',
  RESOURCE_CARD: 'ResourceCard',
  PROFILE_CARD: 'ProfileCard',
};

export function mapSectionTypeToPanel(
  sectionType: PresentationSectionType
): EconomicUiPanelComponent {
  return SECTION_PANEL_MAP[sectionType];
}

export function mapUiTypeToCard(uiType: PresentationUiType): EconomicUiCardComponent {
  return CARD_COMPONENT_MAP[uiType];
}

export function adaptPresentationToUi(
  presentation: EconomicPresentationV1
): EconomicUiSectionProjection[] {
  return presentation.sections.map((section: PresentationSectionV1) => ({
    panelComponent: mapSectionTypeToPanel(section.type),
    section,
    cards: section.cards.map((card: PresentationCardV1) => ({
      component: mapUiTypeToCard(card.uiType),
      card,
    })),
  }));
}
