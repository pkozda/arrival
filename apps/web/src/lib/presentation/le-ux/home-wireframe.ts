import type { LifeEventPlanV1, MissingContextHint } from '@/lib/product-contract';
import type { ActionSurfaceV1 } from '@/lib/life-event-plan';
import { projectLifeEventPage } from '@/lib/life-event-plan';
import type { InsightWireframeContent } from '@/lib/presentation/le-ux/types';
import type { TranslateFn } from '@/lib/life-event/ui-labels';
import { localizeWhatIsBlocking, localizeWhyThisNow } from '@/lib/life-event/content-labels';

export function collectWireframeNodeIds(surface: ActionSurfaceV1): string[] {
  const ids: string[] = [];
  if (surface.primaryAction) {
    ids.push(surface.primaryAction.id);
  }
  for (const node of surface.secondaryActions) {
    ids.push(node.id);
  }
  for (const node of surface.blockedActions) {
    ids.push(node.id);
  }
  for (const node of surface.contextualActions) {
    ids.push(node.id);
  }
  return ids;
}

export function assertNoDuplicateWireframeNodes(surface: ActionSurfaceV1): void {
  const ids = collectWireframeNodeIds(surface);
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw new Error('LE-UX wireframe: duplicate node IDs across action sections');
  }
}

export function buildModuleInsightContent(plan: LifeEventPlanV1, t: TranslateFn): InsightWireframeContent {
  const projection = projectLifeEventPage(plan);

  return {
    whyThisNow: localizeWhyThisNow(plan, t),
    whatIsBlocking: localizeWhatIsBlocking(plan, t),
    showProgressConstrained: projection.showBlockingReasons,
    completenessSummary: null,
    hints: [],
  };
}

export function buildHomeInsightContent(
  input: {
    completenessSummary: string | null;
    hints: MissingContextHint[];
  },
  t: TranslateFn
): InsightWireframeContent {
  const completenessSummary =
    input.completenessSummary && input.completenessSummary.startsWith('life-event.')
      ? t(input.completenessSummary)
      : input.completenessSummary;

  return {
    whyThisNow: [],
    whatIsBlocking: [],
    showProgressConstrained: false,
    completenessSummary,
    hints: input.hints,
  };
}

export function hasHomeInsightContent(insight: InsightWireframeContent): boolean {
  return Boolean(insight.completenessSummary) || insight.hints.length > 0;
}
