'use client';

import { useSyncExternalStore } from 'react';
import type { UxActionCard } from '@/lib/api';
import { buildAttentionFocus } from '@/lib/ux-aggregator';
import { getUxStoreVersion, subscribeUxStore } from '@/lib/ux-store';

function PrimaryActionCard({ action }: { action: UxActionCard }) {
  return (
    <div
      className="card"
      style={{
        padding: '1.75rem',
        border: '2px solid var(--color-primary)',
        background: 'var(--color-primary-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span
          className="badge badge-high"
          style={{
            background: 'var(--color-primary)',
            color: 'white',
            textTransform: 'uppercase',
          }}
        >
          primary
        </span>
        <span className={`badge badge-${action.priority}`}>{action.priority}</span>
      </div>
      <strong style={{ fontSize: '1.125rem', display: 'block', marginBottom: '0.5rem' }}>
        {action.title}
      </strong>
      {action.description && (
        <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
          {action.description}
        </p>
      )}
    </div>
  );
}

export function UxAttentionLayer() {
  useSyncExternalStore(subscribeUxStore, getUxStoreVersion, () => 0);

  const focus = buildAttentionFocus();

  if (!focus?.primaryAction) {
    return null;
  }

  return (
    <section style={{ marginBottom: '2rem' }}>
      <p
        style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--color-primary)',
          marginBottom: '0.5rem',
        }}
      >
        {focus.title}
      </p>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
        Your most important next step
      </h2>
      <p style={{ fontSize: '1rem', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
        {focus.reason}
      </p>
      <PrimaryActionCard action={focus.primaryAction} />
    </section>
  );
}
