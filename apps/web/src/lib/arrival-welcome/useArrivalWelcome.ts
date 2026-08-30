'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupportedLanguage } from '@/lib/product-contract';
import { SUPPORTED_LANGUAGES } from '@/lib/product-contract';
import {
  syncDocumentLanguage,
  writeStoredDisplayLanguage,
} from '@/lib/i18n/display-language';
import {
  detectBrowserLanguage,
  persistArrivalLanguageSelected,
  persistArrivalWelcomeCompleted,
  readArrivalWelcomeRecord,
  shouldShowArrivalWelcome,
  trackArrivalLanguageSelected,
  trackArrivalWelcomeCompleted,
  trackArrivalWelcomeViewed,
  ARRIVAL_WELCOME_COMPLETED_EVENT,
  type ArrivalWelcomeRecordV1,
} from '@/lib/arrival-welcome';

type ChangeLanguageFn = (language: SupportedLanguage) => Promise<void>;

export function useArrivalWelcome() {
  const [record, setRecord] = useState<ArrivalWelcomeRecordV1>(() => readArrivalWelcomeRecord());
  const suggestedLanguage = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return null;
    }
    return detectBrowserLanguage(navigator.language);
  }, []);

  const shouldShow = shouldShowArrivalWelcome(record);
  const selectedLanguage = record.selectedLanguage;

  useEffect(() => {
    if (shouldShow) {
      trackArrivalWelcomeViewed(suggestedLanguage);
    }
  }, [shouldShow, suggestedLanguage]);

  const selectLanguage = useCallback(
    async (language: SupportedLanguage, changeLanguage?: ChangeLanguageFn) => {
      writeStoredDisplayLanguage(language);
      syncDocumentLanguage(language);
      const next = persistArrivalLanguageSelected(language);
      setRecord(next);
      trackArrivalLanguageSelected(language);

      if (changeLanguage) {
        await changeLanguage(language);
      }
    },
    []
  );

  const complete = useCallback(() => {
    const language = record.selectedLanguage;
    if (!language) {
      return;
    }

    const next = persistArrivalWelcomeCompleted(language);
    setRecord({ ...next, state: 'returning_visitor' });
    trackArrivalWelcomeCompleted(language);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(ARRIVAL_WELCOME_COMPLETED_EVENT));
    }
  }, [record.selectedLanguage]);

  return {
    shouldShow,
    suggestedLanguage,
    selectedLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
    selectLanguage,
    complete,
  };
}
