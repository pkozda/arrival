'use client';

import { AtlasLink as Link } from '@/components/atlas-runtime';
import type { LifeEventPlanNode } from '@/lib/product-contract';
import { useApp } from '@/components/AppProvider';
import { lifeEventActionLabel, lifeEventNodeDescription, lifeEventNodeTitle } from '@/lib/life-event/content-labels';
import { lifeEventSeverityLabel } from '@/lib/life-event/ui-labels';
import type { NodeDisabledFn } from '@/lib/presentation/le-ux/types';
import { leBadgeClass, leSeverityClass } from '@/lib/presentation/le-ux/severity';

type Props = {
  node: LifeEventPlanNode | null;
  isNodeDisabled: NodeDisabledFn;
  compact?: boolean;
  emptyMessage?: string;
};

export function HeroActionBlock({ node, isNodeDisabled, compact = false, emptyMessage }: Props) {
  const { t } = useApp();

  if (!node) {
    return (
      <section
        className={`le-hero le-hero--empty${compact ? ' le-hero--compact' : ''}`}
        aria-label={t('life-event.plan.recommendedFocus')}
      >
        <p className="le-empty-state__message">{emptyMessage ?? t('life-event.empty.noPlan')}</p>
      </section>
    );
  }

  const disabled = isNodeDisabled(node.id);
  const primaryAction = node.actions[0];

  return (
    <section
      className={`le-hero ${leSeverityClass(node.priority)}${compact ? ' le-hero--compact' : ''}`}
      aria-label={t('life-event.plan.recommendedFocus')}
    >
      <div className="le-hero__badge-row">
        <span className={leBadgeClass(node.priority)}>{lifeEventSeverityLabel(t, node.priority)}</span>
      </div>
      <h2 className="le-hero__title">{lifeEventNodeTitle(t, node)}</h2>
      <p className="le-hero__description">{lifeEventNodeDescription(t, node)}</p>
      {primaryAction &&
        (disabled ? (
          <span className="btn btn-primary le-hero__cta" aria-disabled="true">
            {lifeEventActionLabel(t, primaryAction)}
          </span>
        ) : (
          <Link href={primaryAction.href} className="btn btn-primary le-hero__cta">
            {lifeEventActionLabel(t, primaryAction)}
          </Link>
        ))}
    </section>
  );
}
