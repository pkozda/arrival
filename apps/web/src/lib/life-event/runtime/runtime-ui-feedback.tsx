import type { CrossModuleSignalV1, RuntimeActionEffectV1 } from './types';

type Props = {
  effect?: RuntimeActionEffectV1 | null;
};

export function RuntimeCrossModuleFeedback({ effect }: Props) {
  if (!effect || effect.stateSignals.length === 0) {
    return null;
  }

  const primarySignal = effect.stateSignals[0];

  return (
    <div
      style={{
        marginBottom: '0.75rem',
        padding: '0.5rem 0.75rem',
        borderRadius: '6px',
        fontSize: '0.8125rem',
        color: 'var(--color-text-muted)',
        background: 'var(--color-surface-muted, rgba(0,0,0,0.03))',
        border: '1px dashed var(--color-border)',
      }}
    >
      <strong style={{ display: 'block', marginBottom: '0.25rem', color: 'inherit' }}>
        Cross-module impact detected
      </strong>
      <span>{primarySignal.message}</span>
      {effect.stateSignals.length > 1 && (
        <span style={{ display: 'block', marginTop: '0.25rem', opacity: 0.85 }}>
          +{effect.stateSignals.length - 1} additional runtime signal
          {effect.stateSignals.length > 2 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

export function hasRuntimeFeedback(effect?: RuntimeActionEffectV1 | null): boolean {
  return Boolean(effect && (effect.stateSignals.length > 0 || effect.moduleMutations.length > 0));
}

export type { CrossModuleSignalV1, RuntimeActionEffectV1 };
