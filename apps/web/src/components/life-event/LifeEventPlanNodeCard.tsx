'use client';

import type { LifeEventPlanNode } from '@/lib/product-contract';
import { LifeEventPlanNodeActions } from '@/components/life-event/LifeEventPlanNodeActions';
import { useApp } from '@/components/AppProvider';
import { lifeEventSeverityLabel } from '@/lib/life-event/ui-labels';
import { lifeEventNodeDescription, lifeEventNodeTitle } from '@/lib/life-event/content-labels';
import { leBadgeClass, leSeverityClass } from '@/lib/presentation/le-ux/severity';

type Props = {
  node: LifeEventPlanNode;
  variant?: 'focus' | 'action' | 'blocker' | 'timeline';
  forceDisabled?: boolean;
};

const VARIANT_CLASS = {
  focus: 'le-node-card--focus',
  action: 'le-node-card--action',
  blocker: 'le-node-card--blocker',
  timeline: 'le-node-card--timeline',
} as const;

export function LifeEventPlanNodeCard({ node, variant = 'action', forceDisabled = false }: Props) {
  const { t } = useApp();
  const actionsDisabled = forceDisabled || variant === 'blocker' || (variant === 'action' && node.blocked);

  return (
    <article className={`le-node-card ${VARIANT_CLASS[variant]} ${leSeverityClass(node.priority)}`}>
      <div className="le-node-card__header">
        <h3 className="le-node-card__title">{lifeEventNodeTitle(t, node)}</h3>
        <span className={leBadgeClass(node.priority)}>{lifeEventSeverityLabel(t, node.priority)}</span>
        {variant === 'blocker' && (
          <span className="badge badge-medium le-node-card__blocked-tag">
            {t('life-event.node.blocked')}
          </span>
        )}
      </div>
      <p className="le-node-card__description">{lifeEventNodeDescription(t, node)}</p>
      <LifeEventPlanNodeActions actions={node.actions} disabled={actionsDisabled} />
    </article>
  );
}
