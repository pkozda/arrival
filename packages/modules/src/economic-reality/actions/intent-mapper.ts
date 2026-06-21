import type { EconomicSystemIntent } from '@arrival-atlas/product-contract';

export type { EconomicSystemIntent };

export const SYSTEM_INTENT_LABELS: Record<EconomicSystemIntent, string> = {
  start_jobcenter_process: 'Start Jobcenter process',
  start_sozialamt_process: 'Start Sozialamt process',
  report_income_change: 'Report income or benefit change',
  initiate_benefit_application: 'Initiate benefit application routing',
};

export function systemIntentLabel(intent: EconomicSystemIntent): string {
  return SYSTEM_INTENT_LABELS[intent];
}
