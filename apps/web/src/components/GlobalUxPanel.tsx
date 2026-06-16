'use client';

import { useSyncExternalStore } from 'react';
import { UxActionPlan } from './UxActionPlan';
import { buildAttentionFocus, buildGlobalUxPlan } from '@/lib/ux-aggregator';
import { getUxStoreVersion, subscribeUxStore } from '@/lib/ux-store';

export function GlobalUxPanel() {
  useSyncExternalStore(subscribeUxStore, getUxStoreVersion, () => 0);

  const plan = buildGlobalUxPlan();
  const focus = buildAttentionFocus();
  const hasAttention = focus?.primaryAction != null;
  const remainingActions = hasAttention && focus?.primaryAction
    ? plan.actions.filter(
        (action) =>
          !(
            action.id === focus.primaryAction!.id &&
            action.source === focus.primaryAction!.source
          )
      )
    : plan.actions;
  const hasActions = remainingActions.length > 0;

  if (!hasActions && !plan.summary.trim()) {
    return null;
  }

  if (!hasActions) {
    return null;
  }

  return (
    <section
      style={{
        marginBottom: '2rem',
        opacity: hasAttention ? 0.92 : 1,
      }}
    >
      <h2
        style={{
          fontSize: hasAttention ? '1.125rem' : '1.25rem',
          fontWeight: 600,
          marginBottom: '1rem',
          color: hasAttention ? 'var(--color-text-muted)' : 'inherit',
        }}
      >
        {hasAttention ? 'Other recommended actions' : 'Global Next Best Actions'}
      </h2>
      <UxActionPlan
        summary={hasAttention ? '' : plan.summary}
        actions={remainingActions}
      />
    </section>
  );
}
