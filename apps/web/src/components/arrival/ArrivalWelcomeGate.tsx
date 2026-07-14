'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useApp } from '@/components/AppProvider';
import { ArrivalWelcomeLayer } from '@/components/arrival/ArrivalWelcomeLayer';
import { useArrivalWelcome } from '@/lib/arrival-welcome/useArrivalWelcome';
import type { SupportedLanguage } from '@/lib/product-contract';

type Props = {
  children: ReactNode;
};

/**
 * E0 — first-contact welcome above the live app environment.
 * Separate from demo exploration state.
 */
export function ArrivalWelcomeGate({ children }: Props) {
  const { changeLanguage } = useApp();
  const welcome = useArrivalWelcome();
  const environmentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = environmentRef.current;
    if (!welcome.shouldShow || !node) {
      return;
    }

    node.setAttribute('inert', '');
    return () => {
      node.removeAttribute('inert');
    };
  }, [welcome.shouldShow]);

  const handleSelectLanguage = useCallback(
    (language: SupportedLanguage) => welcome.selectLanguage(language, changeLanguage),
    [changeLanguage, welcome]
  );

  const handleComplete = useCallback(() => {
    welcome.complete();
  }, [welcome]);

  if (!welcome.shouldShow) {
    return children;
  }

  return (
    <div className="arrival-welcome-gate" data-arrival-welcome-active>
      <div
        ref={environmentRef}
        className="arrival-welcome-gate__environment"
        aria-hidden="true"
      >
        {children}
      </div>
      <ArrivalWelcomeLayer
        suggestedLanguage={welcome.suggestedLanguage}
        selectedLanguage={welcome.selectedLanguage}
        supportedLanguages={welcome.supportedLanguages}
        onSelectLanguage={handleSelectLanguage}
        onComplete={handleComplete}
      />
    </div>
  );
}
