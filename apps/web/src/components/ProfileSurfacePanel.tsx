'use client';

import { useSyncExternalStore } from 'react';
import type { UxActionCard } from '@/lib/api';
import {
  deriveUserState,
  type DerivedUserState,
} from '@/lib/profile-surface';
import { buildGlobalUxPlan } from '@/lib/ux-aggregator';
import { getUxStoreVersion, subscribeUxStore } from '@/lib/ux-store';

type Props = {
  actions: UxActionCard[];
};

type StatusRow = {
  label: string;
  value: string;
  tone: 'alert' | 'positive' | 'neutral';
};

function registrationRow(state: DerivedUserState['registration']): StatusRow {
  switch (state) {
    case 'required':
      return { label: 'Registration', value: 'REQUIRED', tone: 'alert' };
    case 'completed':
      return { label: 'Registration', value: 'COMPLETED', tone: 'positive' };
    default:
      return { label: 'Registration', value: 'UNKNOWN', tone: 'neutral' };
  }
}

function insuranceRow(state: DerivedUserState['insurance']): StatusRow {
  switch (state) {
    case 'missing':
      return { label: 'Health insurance', value: 'MISSING', tone: 'alert' };
    case 'active':
      return { label: 'Health insurance', value: 'ACTIVE', tone: 'positive' };
    default:
      return { label: 'Health insurance', value: 'UNKNOWN', tone: 'neutral' };
  }
}

function benefitsRow(state: DerivedUserState['benefits']): StatusRow {
  switch (state) {
    case 'eligible':
      return { label: 'Benefits', value: 'ELIGIBLE', tone: 'positive' };
    case 'not-eligible':
      return { label: 'Benefits', value: 'NOT ELIGIBLE', tone: 'neutral' };
    default:
      return { label: 'Benefits', value: 'UNKNOWN', tone: 'neutral' };
  }
}

function badgeClass(tone: StatusRow['tone']): string {
  switch (tone) {
    case 'alert':
      return 'badge badge-high';
    case 'positive':
      return 'badge badge-low';
    default:
      return 'badge';
  }
}

function badgeStyle(tone: StatusRow['tone']): Record<string, string | number> {
  if (tone === 'neutral') {
    return {
      background: 'var(--color-surface-hover)',
      color: 'var(--color-text-muted)',
    };
  }

  return {};
}

export function ProfileSurfacePanel({ actions }: Props) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return null;
  }

  const state = deriveUserState(actions);
  const rows = [
    registrationRow(state.registration),
    insuranceRow(state.insurance),
    benefitsRow(state.benefits),
  ];

  return (
    <section
      className="card"
      style={{
        marginBottom: '1.5rem',
        padding: '1.25rem 1.5rem',
      }}
    >
      <p
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--color-text-muted)',
          marginBottom: '0.75rem',
        }}
      >
        Where you are now
      </p>
      <div>
        {rows.map((row, index) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              padding: '0.625rem 0',
              borderBottom: index < rows.length - 1 ? '1px solid var(--color-border)' : undefined,
            }}
          >
            <span style={{ fontSize: '0.9375rem', color: 'var(--color-text-muted)' }}>{row.label}</span>
            <span className={badgeClass(row.tone)} style={badgeStyle(row.tone)}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProfileSurfacePanelFromStore() {
  useSyncExternalStore(subscribeUxStore, getUxStoreVersion, () => 0);

  const { actions } = buildGlobalUxPlan();

  return <ProfileSurfacePanel actions={actions} />;
}
