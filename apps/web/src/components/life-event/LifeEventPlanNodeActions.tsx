'use client';

import { AtlasSecondaryLink } from '@/components/atlas-runtime';
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
    <div className="le-node-actions">
      {actions.map((action) => {
        const label = lifeEventActionLabel(t, action);
        return disabled ? (
          <span
            key={`${action.kind}-${action.href}-${label}`}
            className="btn atlas-secondary-button atlas-secondary-button--compact"
            aria-disabled="true"
          >
            {label}
          </span>
        ) : (
          <AtlasSecondaryLink
            key={`${action.kind}-${action.href}-${label}`}
            href={action.href}
            compact
          >
            {label}
          </AtlasSecondaryLink>
        );
      })}
    </div>
  );
}
