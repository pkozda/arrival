import type { OrderingStrategy, UiStrategy } from '@arrival-atlas/product-contract';
import { SECTION_TYPE_COPY_KEYS } from '@arrival-atlas/product-contract';

export type SectionBuildInput = {
  sectionId: string;
  titleKey: string;
  type: 'PRIMARY' | 'SECONDARY' | 'SYSTEM';
  priority: number;
  sourceTrack: 'primary' | 'secondary' | 'system';
};

export const SECTION_ORDER: SectionBuildInput['type'][] = ['PRIMARY', 'SECONDARY', 'SYSTEM'];

export const SECTION_TITLE_KEYS = SECTION_TYPE_COPY_KEYS;

export function resolveUiStrategy(orderingStrategy: OrderingStrategy): UiStrategy {
  switch (orderingStrategy) {
    case 'CRISIS_FIRST':
      return 'CRISIS_UI';
    case 'INSTITUTION_FIRST':
      return 'INSTITUTION_UI';
    case 'PROGRESSION_FIRST':
      return 'PROGRESSION_UI';
  }
}

export const RULE_IDS = {
  U1: 'RULE_U1:crisis_ui',
  U2: 'RULE_U2:institution_ui',
  U3: 'RULE_U3:progression_ui',
  S1: 'RULE_S1:section_order',
  S2: 'RULE_S2:priority_inheritance',
  C1: 'RULE_C1:action_grouping',
  C2: 'RULE_C2:severity_mapping',
  C3: 'RULE_C3:no_semantic_expansion',
} as const;
