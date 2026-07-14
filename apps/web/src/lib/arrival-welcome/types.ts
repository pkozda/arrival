import type { SupportedLanguage } from '@/lib/product-contract';

/** First-contact arrival experience states (E0). */
export type ArrivalWelcomeState =
  | 'new_visitor'
  | 'language_selected'
  | 'returning_visitor'
  | 'completed';

export type ArrivalWelcomeRecordV1 = {
  version: 1;
  state: ArrivalWelcomeState;
  selectedLanguage?: SupportedLanguage;
  completedAt?: string;
};

export const ARRIVAL_WELCOME_STORAGE_KEY = 'arrival_atlas_welcome_state';

export const ARRIVAL_WELCOME_COMPLETED_EVENT = 'arrival-atlas:welcome-completed';
