'use client';

import type { LifeEventPlanNode } from '@/lib/product-contract';
import { LifeEventPlanNodeCard } from '@/components/life-event/LifeEventPlanNodeCard';
import { useApp } from '@/components/AppProvider';
import type { ActionBreakdownSectionProps } from '@/lib/presentation/le-ux/types';
import { LeEmptyState } from '@/lib/presentation/le-ux/components/LeEmptyState';

function SecondaryColumn({
  nodes,
  isNodeDisabled,
  emptyMessage,
  emptyHint,
}: {
  nodes: LifeEventPlanNode[];
  isNodeDisabled: ActionBreakdownSectionProps['isNodeDisabled'];
  emptyMessage: string;
  emptyHint: string;
}) {
  const { t } = useApp();

  return (
    <div className="le-breakdown__column le-breakdown__column--secondary">
      <h3 className="le-breakdown__heading">{t('life-event.plan.nextActions')}</h3>
      {nodes.map((node) => (
        <LifeEventPlanNodeCard
          key={node.id}
          node={node}
          variant="action"
          forceDisabled={isNodeDisabled(node.id)}
        />
      ))}
      {nodes.length === 0 && <LeEmptyState message={emptyMessage} hint={emptyHint} tone="neutral" />}
    </div>
  );
}

function BlockedColumn({
  nodes,
  isNodeDisabled,
  emptyMessage,
  emptyHint,
}: {
  nodes: LifeEventPlanNode[];
  isNodeDisabled: ActionBreakdownSectionProps['isNodeDisabled'];
  emptyMessage: string;
  emptyHint: string;
}) {
  const { t } = useApp();

  return (
    <div className="le-breakdown__column le-breakdown__column--blocked">
      <h3 className="le-breakdown__heading">{t('life-event.plan.blockedActions')}</h3>
      {nodes.map((node) => (
        <LifeEventPlanNodeCard
          key={node.id}
          node={node}
          variant="blocker"
          forceDisabled={isNodeDisabled(node.id, true)}
        />
      ))}
      {nodes.length === 0 && <LeEmptyState message={emptyMessage} hint={emptyHint} tone="positive" />}
    </div>
  );
}

function ContextualColumn({
  nodes,
  isNodeDisabled,
  defaultOpen,
  emptyMessage,
  emptyHint,
}: {
  nodes: LifeEventPlanNode[];
  isNodeDisabled: ActionBreakdownSectionProps['isNodeDisabled'];
  defaultOpen: boolean;
  emptyMessage: string;
  emptyHint: string;
}) {
  const { t } = useApp();

  return (
    <details className="le-contextual-panel" open={defaultOpen}>
      <summary>
        {t('life-event.timeline.upcomingSteps')}
        {nodes.length > 0 && <span className="le-contextual-panel__count">({nodes.length})</span>}
      </summary>
      <div className="le-contextual-panel__body">
        {nodes.length === 0 ? (
          <LeEmptyState message={emptyMessage} hint={emptyHint} tone="future" />
        ) : (
          nodes.map((node) => (
            <LifeEventPlanNodeCard
              key={node.id}
              node={node}
              variant="timeline"
              forceDisabled={isNodeDisabled(node.id)}
            />
          ))
        )}
      </div>
    </details>
  );
}

export function ActionBreakdownBlock({
  secondaryActions,
  blockedActions,
  contextualActions,
  isNodeDisabled,
  contextualDefaultOpen,
}: ActionBreakdownSectionProps) {
  const { t } = useApp();

  return (
    <section className="le-breakdown" aria-label={t('life-event.plan.nextActions')}>
      <SecondaryColumn
        nodes={secondaryActions}
        isNodeDisabled={isNodeDisabled}
        emptyMessage={t('life-event.empty.noUpcomingActions')}
        emptyHint={t('life-event.empty.noUpcomingActions.hint')}
      />
      <BlockedColumn
        nodes={blockedActions}
        isNodeDisabled={isNodeDisabled}
        emptyMessage={t('life-event.empty.noBlockers')}
        emptyHint={t('life-event.empty.noBlockers.hint')}
      />
      <ContextualColumn
        nodes={contextualActions}
        isNodeDisabled={isNodeDisabled}
        defaultOpen={contextualDefaultOpen}
        emptyMessage={t('life-event.empty.noTimelineItems')}
        emptyHint={t('life-event.empty.noTimelineItems.hint')}
      />
    </section>
  );
}
