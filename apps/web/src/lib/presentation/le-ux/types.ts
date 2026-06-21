import type {
  LifeEventPlanNode,
  LifeEventPlanV1,
  MissingContextHint,
} from '@/lib/product-contract';
import type { ActionSurfaceV1, ExecutionSurfaceV1 } from '@/lib/life-event-plan';
import type { ScenarioMatchV1 } from '@/lib/life-event/scenarios';
import type { RuntimeActionEffectV1 } from '@/lib/life-event/runtime';

export type NodeDisabledFn = (nodeId: string, fallbackBlocked?: boolean) => boolean;

export type InsightWireframeContent = {
  whyThisNow: string[];
  whatIsBlocking: string[];
  showProgressConstrained: boolean;
  completenessSummary: string | null;
  hints: MissingContextHint[];
};

export type LifeEventWireframeLayoutProps = {
  plan: LifeEventPlanV1;
  surface: ActionSurfaceV1;
  scenario?: ScenarioMatchV1 | null;
  runtimeEffect?: RuntimeActionEffectV1 | null;
  isNodeDisabled: NodeDisabledFn;
  insight: InsightWireframeContent;
  contextualDefaultOpen: boolean;
  showRuntimeFeedback: boolean;
};

export type HomeLifeEventWireframeProps = {
  plan: LifeEventPlanV1 | null;
  loading?: boolean;
  error?: string | null;
  executionSurface?: ExecutionSurfaceV1 | null;
  scenario?: ScenarioMatchV1 | null;
  runtimeEffect?: RuntimeActionEffectV1 | null;
  insight: Omit<InsightWireframeContent, 'whyThisNow' | 'whatIsBlocking' | 'showProgressConstrained'>;
};

export type ModuleLifeEventWireframeProps = {
  plan: LifeEventPlanV1;
  executionSurface?: ExecutionSurfaceV1 | null;
  scenario?: ScenarioMatchV1 | null;
  loading?: boolean;
};

export type ActionBreakdownSectionProps = {
  secondaryActions: LifeEventPlanNode[];
  blockedActions: LifeEventPlanNode[];
  contextualActions: LifeEventPlanNode[];
  isNodeDisabled: NodeDisabledFn;
  contextualDefaultOpen: boolean;
};
