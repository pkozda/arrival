'use client';

import { useEffect, useState } from 'react';
import type { OnboardingStep } from '@/lib/situation-utils';
import { ONBOARDING_DISMISS_STORAGE_KEY } from '@/lib/situation-utils';

type Props = {
  steps: OnboardingStep[];
  onDismiss?: () => void;
};

function StepIcon({ complete }: { complete: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        width: '1.125rem',
        height: '1.125rem',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: 700,
        marginRight: '0.625rem',
        flexShrink: 0,
        background: complete ? 'var(--color-accent)' : 'transparent',
        color: complete ? 'white' : 'var(--color-text-muted)',
        border: complete ? 'none' : '1px solid var(--color-border)',
      }}
    >
      {complete ? '✓' : ''}
    </span>
  );
}

export function useOnboardingDismissed(): [boolean, () => void] {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(ONBOARDING_DISMISS_STORAGE_KEY) === 'true');
    } catch {
      setDismissed(false);
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(ONBOARDING_DISMISS_STORAGE_KEY, 'true');
    } catch {
      // ignore storage failures
    }
    setDismissed(true);
  }

  return [dismissed, dismiss];
}

export function OnboardingChecklistCard({ steps, onDismiss }: Props) {
  const completedCount = steps.filter((step) => step.complete).length;

  return (
    <section className="card" style={{ marginBottom: '1rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          marginBottom: '0.75rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Getting oriented in Germany
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            {completedCount} of {steps.length} steps complete
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Dismiss
          </button>
        )}
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
        {steps.map((step) => (
          <li
            key={step.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '0.9375rem',
              color: step.complete ? 'var(--color-text-muted)' : 'inherit',
              textDecoration: step.complete ? 'line-through' : 'none',
            }}
          >
            <StepIcon complete={step.complete} />
            <span>{step.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
