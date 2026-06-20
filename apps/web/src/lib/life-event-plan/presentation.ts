import type { LifeEventPlanNode, LifeEventPlanV1 } from '@/lib/product-contract';

export type HomeNextStepsProjection = {
  focus: LifeEventPlanNode;
  nextActions: LifeEventPlanNode[];
  blockers: LifeEventPlanNode[];
  showBlockers: boolean;
};

export type LifeEventPageProjection = {
  lifeStateLabel: string;
  focus: LifeEventPlanNode;
  whyThisNow: string[];
  activeBlocks: LifeEventPlanNode[];
  blockingReasons: string[];
  nextActions: LifeEventPlanNode[];
  timeline: LifeEventPlanNode[];
  showActiveBlocks: boolean;
  showBlockingReasons: boolean;
  showTimeline: boolean;
};

export function formatLifeStateLabel(lifeState: string): string {
  return lifeState
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function projectHomeNextSteps(plan: LifeEventPlanV1): HomeNextStepsProjection {
  return {
    focus: plan.currentFocus,
    nextActions: plan.nextBestActions.slice(0, 4),
    blockers: plan.activeBlocks,
    showBlockers: plan.activeBlocks.length > 0,
  };
}

export function projectLifeEventPage(plan: LifeEventPlanV1): LifeEventPageProjection {
  return {
    lifeStateLabel: formatLifeStateLabel(plan.currentLifeState),
    focus: plan.currentFocus,
    whyThisNow: plan.reasoning.whyThisNow,
    activeBlocks: plan.activeBlocks,
    blockingReasons: plan.reasoning.whatIsBlocking,
    nextActions: plan.nextBestActions.slice(0, 5),
    timeline: plan.timeline,
    showActiveBlocks: plan.activeBlocks.length > 0,
    showBlockingReasons: plan.reasoning.whatIsBlocking.length > 0,
    showTimeline: plan.timeline.length > 0,
  };
}

export {
  projectActionSurface,
  EMPTY_ACTION_SURFACE,
  collectActionSurfaceNodeIds,
  type ActionSurfaceV1,
} from './actions';

export {
  buildExecutionSurface,
  buildExecutionSurfaceOrEmpty,
  buildExecutionStateLookup,
  isExecutionDisabled,
  EMPTY_EXECUTION_SURFACE,
  type ExecutionAction,
  type ExecutionBlockedAction,
  type ExecutionSurfaceV1,
} from './execution';

export { mergeP4WithPlan, type P4PlanOverlayV1 } from './p4-merge';
export { dedupeHomeSurfaces, type HomeDedupResultV1 } from './home-dedup';
export { buildHomePlanViewModelV2, type HomePlanViewModelV2, type BuildHomePlanViewModelInput } from './presentation-v2';
