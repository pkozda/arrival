'use client';

import { useCallback, useMemo } from 'react';
import {
  ARRIVAL_WELCOME_COPY,
  ARRIVAL_WELCOME_NEUTRAL_COPY,
} from '@/lib/arrival-welcome';
import { usePrefersReducedMotion } from '@/lib/presentation/useHomeLandingMotion';
import {
  ContinueAction,
  LanguageSelector,
  WelcomeMessage,
  WelcomeShell,
  type ArrivalWelcomeLayerProps,
} from '@/components/arrival/welcome';

export function ArrivalWelcomeLayer({
  suggestedLanguage,
  selectedLanguage,
  supportedLanguages,
  onSelectLanguage,
  onComplete,
}: ArrivalWelcomeLayerProps) {
  const reducedMotion = usePrefersReducedMotion();
  const previewLanguage = selectedLanguage ?? 'en';
  const copy = useMemo(
    () => (selectedLanguage ? ARRIVAL_WELCOME_COPY[previewLanguage] : ARRIVAL_WELCOME_NEUTRAL_COPY),
    [previewLanguage, selectedLanguage]
  );

  const handleContinue = useCallback(() => {
    if (!selectedLanguage) {
      return;
    }
    onComplete();
  }, [onComplete, selectedLanguage]);

  return (
    <WelcomeShell reducedMotion={reducedMotion}>
      <WelcomeMessage copy={copy} />
      <LanguageSelector
        copy={copy}
        suggestedLanguage={suggestedLanguage}
        selectedLanguage={selectedLanguage}
        supportedLanguages={supportedLanguages}
        onSelectLanguage={onSelectLanguage}
      />
      <ContinueAction
        label={copy.continue}
        disabled={!selectedLanguage}
        onContinue={handleContinue}
      />
    </WelcomeShell>
  );
}
