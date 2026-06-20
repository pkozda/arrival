'use client';

import Link from 'next/link';
import type { LifeActionRef } from '@/lib/product-contract';
import { useApp } from '@/components/AppProvider';
import { lifeEventActionLabel } from '@/lib/life-event/content-labels';

type Props = {
  actions: LifeActionRef[];
  disabled?: boolean;
};

export function LifeEventPlanNodeActions({ actions, disabled = false }: Props) {
  const { t } = useApp();

  if (actions.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
      {actions.map((action) => {
        const label = lifeEventActionLabel(t, action);
        return disabled ? (
          <span
            key={`${action.kind}-${action.href}-${label}`}
            className="btn btn-secondary"
            style={{
              fontSize: '0.8125rem',
              padding: '0.375rem 0.75rem',
              opacity: 0.55,
              cursor: 'not-allowed',
              pointerEvents: 'none',
            }}
            aria-disabled="true"
          >
            {label}
          </span>
        ) : (
          <Link
            key={`${action.kind}-${action.href}-${label}`}
            href={action.href}
            className="btn btn-secondary"
            style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
