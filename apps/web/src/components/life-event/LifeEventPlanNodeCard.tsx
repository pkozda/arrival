'use client';

import type { LifeEventPlanNode } from '@/lib/product-contract';
import { LifeEventPlanNodeActions } from '@/components/life-event/LifeEventPlanNodeActions';
import { useApp } from '@/components/AppProvider';
import { lifeEventSeverityLabel } from '@/lib/life-event/ui-labels';
import { lifeEventNodeDescription, lifeEventNodeTitle } from '@/lib/life-event/content-labels';

type Props = {
  node: LifeEventPlanNode;
  variant?: 'focus' | 'action' | 'blocker' | 'timeline';
  forceDisabled?: boolean;
};

const variantStyles = {
  focus: {
    border: '2px solid var(--color-accent)',
    background: 'var(--color-surface-elevated, var(--color-surface))',
  },
  action: {
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
  },
  blocker: {
    border: '1px solid var(--color-warning, #c9a227)',
    background: 'rgba(201, 162, 39, 0.08)',
  },
  timeline: {
    border: '1px solid var(--color-border)',
    background: 'transparent',
  },
} as const;

export function LifeEventPlanNodeCard({ node, variant = 'action', forceDisabled = false }: Props) {
  const { t } = useApp();
  const style = variantStyles[variant];
  const actionsDisabled = forceDisabled || variant === 'blocker' || (variant === 'action' && node.blocked);

  return (
    <article
      style={{
        ...style,
        borderRadius: '0.5rem',
        padding: variant === 'focus' ? '1rem' : '0.75rem',
        marginBottom: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h3
          style={{
            fontSize: variant === 'focus' ? '1.0625rem' : '0.9375rem',
            fontWeight: variant === 'focus' ? 700 : 600,
            margin: 0,
          }}
        >
          {lifeEventNodeTitle(t, node)}
        </h3>
        <span className={`badge badge-${node.priority}`}>{lifeEventSeverityLabel(t, node.priority)}</span>
        {node.blocked && variant !== 'blocker' && (
          <span className="badge badge-medium" style={{ opacity: 0.85 }}>
            {t('life-event.node.blocked')}
          </span>
        )}
      </div>
      <p
        style={{
          fontSize: '0.875rem',
          color: 'var(--color-text-muted)',
          marginTop: '0.375rem',
          marginBottom: 0,
          lineHeight: 1.5,
        }}
      >
        {lifeEventNodeDescription(t, node)}
      </p>
      <LifeEventPlanNodeActions actions={node.actions} disabled={actionsDisabled} />
    </article>
  );
}
