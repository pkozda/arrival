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
  const copy = useMemo(
    () => (selectedLanguage ? ARRIVAL_WELCOME_COPY[selectedLanguage] : ARRIVAL_WELCOME_NEUTRAL_COPY),
    [selectedLanguage]
  );

  const handleContinue = useCallback(() => {
    if (!selectedLanguage) {
      return;
    }
    onComplete();
  }, [onComplete, selectedLanguage]);

  return (
    <WelcomeShell reducedMotion={reducedMotion}>
      {/* Hierarchy: arrival → languages (primary) → trust → continue */}
      <WelcomeMessage copy={copy} />
      <LanguageSelector
        copy={copy}
        suggestedLanguage={suggestedLanguage}
        selectedLanguage={selectedLanguage}
        supportedLanguages={supportedLanguages}
        onSelectLanguage={onSelectLanguage}
      />
      {copy.trust ? <p className="arrival-welcome__trust">{copy.trust}</p> : null}
      <ContinueAction
        label={copy.continue}
        disabled={!selectedLanguage}
        onContinue={handleContinue}
      />
    </WelcomeShell>
  );
}
