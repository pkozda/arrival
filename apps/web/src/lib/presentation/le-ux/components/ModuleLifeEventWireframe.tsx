'use client';

import type { ModuleLifeEventWireframeProps } from '@/lib/presentation/le-ux/types';
import { ActionBreakdownBlock } from '@/lib/presentation/le-ux/components/ActionBreakdownBlock';
import { WireframeSkeleton } from '@/lib/presentation/le-ux/components/WireframeSkeleton';
import { buildModuleWireframeRuntime } from '@/lib/presentation/le-ux/module-wireframe';
import { normalizeWireframeSurface } from '@/lib/presentation/le-ux/wireframe-surface';

type Props = ModuleLifeEventWireframeProps;

export function ModuleLifeEventWireframe({
  plan,
  executionSurface,
  loading,
}: Props) {
  if (loading) {
    return (
      <div className="le-galaxy-viewport__overlay">
        <WireframeSkeleton />
      </div>
    );
  }

  const { surface: rawSurface, isNodeDisabled } = buildModuleWireframeRuntime(plan, executionSurface);
  const surface = normalizeWireframeSurface(rawSurface);

  return (
    <ActionBreakdownBlock
      plan={plan}
      primaryAction={surface.primaryAction}
      secondaryActions={surface.secondaryActions}
      blockedActions={surface.blockedActions}
      contextualActions={surface.contextualActions}
      isNodeDisabled={isNodeDisabled}
      contextualDefaultOpen={false}
      variant="module"
    />
  );
}
