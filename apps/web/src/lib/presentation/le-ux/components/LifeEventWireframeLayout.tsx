'use client';

import { RuntimeCrossModuleFeedback } from '@/lib/life-event/runtime';
import { HeaderContextBlock } from '@/lib/presentation/le-ux/components/HeaderContextBlock';
import { HeroActionBlock } from '@/lib/presentation/le-ux/components/HeroActionBlock';
import { ActionBreakdownBlock } from '@/lib/presentation/le-ux/components/ActionBreakdownBlock';
import { InsightBlock } from '@/lib/presentation/le-ux/components/InsightBlock';
import { ScenarioBanner } from '@/lib/presentation/le-ux/components/ScenarioBanner';
import type { LifeEventWireframeLayoutProps } from '@/lib/presentation/le-ux/types';
import { useApp } from '@/components/AppProvider';

type Props = LifeEventWireframeLayoutProps & {
  variant: 'home' | 'module';
  heroCompact?: boolean;
};

export function LifeEventWireframeLayout({
  plan,
  surface,
  scenario,
  runtimeEffect,
  isNodeDisabled,
  insight,
  contextualDefaultOpen,
  showRuntimeFeedback,
  variant,
  heroCompact = false,
}: Props) {
  const { t } = useApp();

  return (
    <div className="le-wireframe">
      <HeaderContextBlock plan={plan} scenario={scenario} />

      {scenario && <ScenarioBanner scenario={scenario} />}

      <HeroActionBlock
        node={surface.primaryAction}
        isNodeDisabled={isNodeDisabled}
        compact={heroCompact}
        emptyMessage={t('life-event.empty.noPlan')}
      />

      <ActionBreakdownBlock
        secondaryActions={surface.secondaryActions}
        blockedActions={surface.blockedActions}
        contextualActions={surface.contextualActions}
        isNodeDisabled={isNodeDisabled}
        contextualDefaultOpen={contextualDefaultOpen}
      />

      <InsightBlock variant={variant} {...insight} />

      {showRuntimeFeedback && <RuntimeCrossModuleFeedback effect={runtimeEffect} />}
    </div>
  );
}
