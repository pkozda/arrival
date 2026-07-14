import type { SupportedLanguage } from '@/lib/product-contract';

export const ARRIVAL_WELCOME_TELEMETRY_EVENT = 'arrival-atlas:arrival-welcome-telemetry';

export type ArrivalWelcomeTelemetryName =
  | 'arrival_welcome_viewed'
  | 'arrival_language_selected'
  | 'arrival_welcome_completed';

export type ArrivalWelcomeTelemetryDetail = {
  name: ArrivalWelcomeTelemetryName;
  at: string;
  suggestedLanguage?: SupportedLanguage | null;
  language?: SupportedLanguage;
};

export function emitArrivalWelcomeTelemetry(
  detail: Omit<ArrivalWelcomeTelemetryDetail, 'at'> & { at?: string }
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: ArrivalWelcomeTelemetryDetail = {
    ...detail,
    at: detail.at ?? new Date().toISOString(),
  };

  window.dispatchEvent(
    new CustomEvent<ArrivalWelcomeTelemetryDetail>(ARRIVAL_WELCOME_TELEMETRY_EVENT, {
      detail: payload,
    })
  );
}

export function trackArrivalWelcomeViewed(suggestedLanguage: SupportedLanguage | null): void {
  emitArrivalWelcomeTelemetry({
    name: 'arrival_welcome_viewed',
    suggestedLanguage,
  });
}

export function trackArrivalLanguageSelected(language: SupportedLanguage): void {
  emitArrivalWelcomeTelemetry({
    name: 'arrival_language_selected',
    language,
  });
}

export function trackArrivalWelcomeCompleted(language: SupportedLanguage): void {
  emitArrivalWelcomeTelemetry({
    name: 'arrival_welcome_completed',
    language,
  });
}
