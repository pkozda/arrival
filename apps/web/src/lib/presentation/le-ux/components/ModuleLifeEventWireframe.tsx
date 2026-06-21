'use client';

import type { ModuleLifeEventWireframeProps } from '@/lib/presentation/le-ux/types';
import { useApp } from '@/components/AppProvider';
import { LifeEventWireframeLayout } from '@/lib/presentation/le-ux/components/LifeEventWireframeLayout';
import { WireframeSkeleton } from '@/lib/presentation/le-ux/components/WireframeSkeleton';
import { buildModuleInsightContent } from '@/lib/presentation/le-ux/home-wireframe';
import { buildModuleWireframeRuntime } from '@/lib/presentation/le-ux/module-wireframe';
import { normalizeWireframeSurface } from '@/lib/presentation/le-ux/wireframe-surface';

type Props = ModuleLifeEventWireframeProps;

export function ModuleLifeEventWireframe({
  plan,
  executionSurface,
  scenario,
  loading,
}: Props) {
  const { t } = useApp();

  if (loading) {
    return (
      <div className="card le-plan-card">
        <WireframeSkeleton />
      </div>
    );
  }

  const { surface: rawSurface, isNodeDisabled } = buildModuleWireframeRuntime(plan, executionSurface);
  const surface = normalizeWireframeSurface(rawSurface);
  const insight = buildModuleInsightContent(plan, t);

  return (
    <div className="card le-plan-card">
      <LifeEventWireframeLayout
        plan={plan}
        surface={surface}
        scenario={scenario}
        isNodeDisabled={isNodeDisabled}
        insight={insight}
        contextualDefaultOpen={false}
        showRuntimeFeedback={false}
        variant="module"
      />
    </div>
  );
}
