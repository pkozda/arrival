'use client';

import { useEffect, useRef } from 'react';
import type { SupportedLanguage } from '@/lib/product-contract';
import {
  ARRIVAL_LANGUAGE_FLAGS,
  ARRIVAL_LANGUAGE_LABELS,
  type ArrivalWelcomeCopy,
} from '@/lib/arrival-welcome';

type Props = {
  copy: ArrivalWelcomeCopy;
  suggestedLanguage: SupportedLanguage | null;
  selectedLanguage?: SupportedLanguage;
  supportedLanguages: readonly SupportedLanguage[];
  onSelectLanguage: (language: SupportedLanguage) => void | Promise<void>;
};

export function LanguageSelector({
  copy,
  suggestedLanguage,
  selectedLanguage,
  supportedLanguages,
  onSelectLanguage,
}: Props) {
  const initialFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    initialFocusRef.current?.focus();
  }, []);

  const focusLanguage =
    suggestedLanguage && supportedLanguages.includes(suggestedLanguage)
      ? suggestedLanguage
      : supportedLanguages[0];

  return (
    <div className="arrival-welcome__languages-wrap">
      <h2 id="arrival-welcome-languages-heading" className="arrival-welcome__languages-heading">
        {copy.languageHeading}
      </h2>
      <div
        className="arrival-welcome__languages"
        role="group"
        aria-labelledby="arrival-welcome-languages-heading"
      >
        {supportedLanguages.map((language) => {
          const isSelected = selectedLanguage === language;
          const isSuggested = suggestedLanguage === language && !selectedLanguage;
          const shouldReceiveInitialFocus = language === focusLanguage;

          return (
            <button
              key={language}
              ref={shouldReceiveInitialFocus ? initialFocusRef : undefined}
              type="button"
              id={shouldReceiveInitialFocus ? 'arrival-welcome-first-language' : undefined}
              className={`arrival-welcome__lang-btn${isSelected ? ' is-selected' : ''}${
                isSuggested ? ' is-suggested' : ''
              }`}
              aria-pressed={isSelected}
              aria-label={
                isSelected
                  ? `${ARRIVAL_LANGUAGE_LABELS[language]}, selected`
                  : ARRIVAL_LANGUAGE_LABELS[language]
              }
              data-suggested={isSuggested ? 'true' : undefined}
              onClick={() => void onSelectLanguage(language)}
            >
              <span className="arrival-welcome__lang-row">
                <span className="arrival-welcome__lang-flag" aria-hidden="true">
                  {ARRIVAL_LANGUAGE_FLAGS[language]}
                </span>
                <span className="arrival-welcome__lang-label">{ARRIVAL_LANGUAGE_LABELS[language]}</span>
              </span>
              {isSuggested && (
                <span className="arrival-welcome__lang-hint">{copy.suggestedLabel}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
