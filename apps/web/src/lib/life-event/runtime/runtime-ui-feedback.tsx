'use client';

import type { CrossModuleSignalV1, RuntimeActionEffectV1 } from './types';
import { useApp } from '@/components/AppProvider';
import { localizeRuntimeSignal } from '@/lib/life-event/content-labels';

type Props = {
  effect?: RuntimeActionEffectV1 | null;
};

export function RuntimeCrossModuleFeedback({ effect }: Props) {
  const { t } = useApp();

  if (!effect || effect.stateSignals.length === 0) {
    return null;
  }

  const primarySignal = effect.stateSignals[0];

  return (
    <div className="le-runtime-feedback" role="status">
      <strong className="le-runtime-feedback__title">{t('life-event.runtime.crossModuleImpact')}</strong>
      <span>{localizeRuntimeSignal(t, primarySignal)}</span>
      {effect.stateSignals.length > 1 && (
        <span className="le-runtime-feedback__more">
          +{effect.stateSignals.length - 1}{' '}
          {effect.stateSignals.length > 2
            ? t('life-event.runtime.additionalSignals')
            : t('life-event.runtime.additionalSignal')}
        </span>
      )}
    </div>
  );
}

export function hasRuntimeFeedback(effect?: RuntimeActionEffectV1 | null): boolean {
  return Boolean(effect && (effect.stateSignals.length > 0 || effect.moduleMutations.length > 0));
}

export type { CrossModuleSignalV1, RuntimeActionEffectV1 };
