import type { EconomicSystemIntent, PresentationUiType } from '@arrival-atlas/product-contract';
import { ER_COPY_KEYS, SYSTEM_INTENT_COPY_KEYS } from '@arrival-atlas/product-contract';

export const INTENT_UI_MAP: Record<EconomicSystemIntent, PresentationUiType> = {
  start_jobcenter_process: 'INTENT_CARD',
  start_sozialamt_process: 'INTENT_CARD',
  report_income_change: 'PROFILE_CARD',
  initiate_benefit_application: 'INTENT_CARD',
};

export const INSTITUTION_SYSTEM_INTENTS = new Set<EconomicSystemIntent>([
  'start_jobcenter_process',
  'start_sozialamt_process',
  'report_income_change',
  'initiate_benefit_application',
]);

export function resolveIntentUiType(intent: EconomicSystemIntent): PresentationUiType {
  return INTENT_UI_MAP[intent];
}

export function isInstitutionIntent(intent: EconomicSystemIntent | undefined): boolean {
  return intent !== undefined && INSTITUTION_SYSTEM_INTENTS.has(intent);
}

export function intentFocusKey(intent: EconomicSystemIntent): string {
  return SYSTEM_INTENT_COPY_KEYS[intent];
}

export function crisisHighlightKey(): string {
  return ER_COPY_KEYS.SYSTEM_CRISIS_WARNING;
}
