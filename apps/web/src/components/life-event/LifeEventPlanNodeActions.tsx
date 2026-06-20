import Link from 'next/link';
import type { LifeActionRef } from '@/lib/product-contract';

type Props = {
  actions: LifeActionRef[];
  disabled?: boolean;
};

export function LifeEventPlanNodeActions({ actions, disabled = false }: Props) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
      {actions.map((action) =>
        disabled ? (
          <span
            key={`${action.kind}-${action.href}-${action.label}`}
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
            {action.label}
          </span>
        ) : (
          <Link
            key={`${action.kind}-${action.href}-${action.label}`}
            href={action.href}
            className="btn btn-secondary"
            style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
          >
            {action.label}
          </Link>
        )
      )}
    </div>
  );
}
