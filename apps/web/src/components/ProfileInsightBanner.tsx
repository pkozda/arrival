'use client';

import { useSyncExternalStore } from 'react';
import type { UxActionCard } from '@/lib/api';
import { deriveProfileInsight } from '@/lib/profile-insight';
import { buildGlobalUxPlan } from '@/lib/ux-aggregator';
import { getUxStoreVersion, subscribeUxStore } from '@/lib/ux-store';

export type ProfileInsightProps = {
  actions: UxActionCard[];
};

export function ProfileInsightBanner({ actions }: ProfileInsightProps) {
  const insight = deriveProfileInsight(actions);

  if (!insight) {
    return null;
  }

  return (
    <section
      className="card"
      style={{
        marginBottom: '1.5rem',
        padding: '1.25rem 1.5rem',
        borderColor: 'var(--color-border)',
        background: 'var(--color-surface)',
      }}
    >
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <span
          aria-hidden
          style={{
            fontSize: '1.125rem',
            lineHeight: 1.4,
            opacity: 0.85,
          }}
        >
          {insight.icon}
        </span>
        <div>
          <p
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text-muted)',
              marginBottom: '0.35rem',
            }}
          >
            Why you are seeing these actions
          </p>
          <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            {insight.title}
          </h2>
          <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            {insight.explanation}
          </p>
        </div>
      </div>
    </section>
  );
}

export function ProfileInsightBannerFromStore() {
  useSyncExternalStore(subscribeUxStore, getUxStoreVersion, () => 0);

  const { actions } = buildGlobalUxPlan();

  return <ProfileInsightBanner actions={actions} />;
}
