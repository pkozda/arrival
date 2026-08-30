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

const LANGUAGE_GROUP_ARIA_LABEL = 'Deutsch · Українська · Русский · English';

export function LanguageSelector({
  copy,
  suggestedLanguage,
  selectedLanguage,
  supportedLanguages,
  onSelectLanguage,
}: Props) {
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const promptId = 'arrival-welcome-languages-heading';
  const hasVisiblePrompt = Boolean(copy.languagePrompt.trim());

  useEffect(() => {
    initialFocusRef.current?.focus();
  }, []);

  const focusLanguage =
    suggestedLanguage && supportedLanguages.includes(suggestedLanguage)
      ? suggestedLanguage
      : supportedLanguages[0];

  return (
    <div className="arrival-welcome__languages-wrap">
      {hasVisiblePrompt ? (
        <p id={promptId} className="arrival-welcome__language-prompt">
          {copy.languagePrompt}
        </p>
      ) : (
        <span id={promptId} className="arrival-welcome__language-prompt-sr">
          {LANGUAGE_GROUP_ARIA_LABEL}
        </span>
      )}
      <div
        className="arrival-welcome__languages"
        role="group"
        aria-labelledby={promptId}
      >
        {supportedLanguages.map((language) => {
          const isSelected = selectedLanguage === language;
          const isSuggested = suggestedLanguage === language && !selectedLanguage;
          const shouldReceiveInitialFocus = language === focusLanguage;
          const nativeLabel = ARRIVAL_LANGUAGE_LABELS[language];

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
                  ? `${nativeLabel}, selected`
                  : isSuggested
                    ? `${nativeLabel}, suggested`
                    : nativeLabel
              }
              data-suggested={isSuggested ? 'true' : undefined}
              onClick={() => void onSelectLanguage(language)}
            >
              <span className="arrival-welcome__lang-row">
                <span className="arrival-welcome__lang-flag" aria-hidden="true">
                  {ARRIVAL_LANGUAGE_FLAGS[language]}
                </span>
                <span className="arrival-welcome__lang-label">{nativeLabel}</span>
                {isSelected && (
                  <span className="arrival-welcome__lang-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </span>
              {isSuggested && (
                <span className="arrival-welcome__lang-hint" aria-hidden="true">
                  {copy.suggestedLabel.trim() ? copy.suggestedLabel : '✦'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
