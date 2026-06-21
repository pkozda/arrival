import type { LifeEventPlanV1 } from '@/lib/product-contract';
import type { ActionSurfaceV1, ExecutionSurfaceV1 } from '@/lib/life-event-plan';
import {
  buildExecutionStateLookup,
  buildExecutionSurface,
  isExecutionDisabled,
  projectActionSurface,
} from '@/lib/life-event-plan';
import type { NodeDisabledFn } from '@/lib/presentation/le-ux/types';
import { assertNoDuplicateWireframeNodes } from '@/lib/presentation/le-ux/home-wireframe';

export type ModuleWireframeRuntime = {
  surface: ActionSurfaceV1;
  isNodeDisabled: NodeDisabledFn;
};

export function buildModuleWireframeRuntime(
  plan: LifeEventPlanV1,
  executionSurface?: ExecutionSurfaceV1 | null
): ModuleWireframeRuntime {
  const surface = projectActionSurface(plan);
  assertNoDuplicateWireframeNodes(surface);

  const execution =
    executionSurface === null ? null : executionSurface ?? buildExecutionSurface(surface);
  const executionLookup = execution ? buildExecutionStateLookup(execution) : null;

  const isNodeDisabled: NodeDisabledFn = (nodeId, fallbackBlocked = false) =>
    executionLookup ? isExecutionDisabled(executionLookup, nodeId) : fallbackBlocked;

  return { surface, isNodeDisabled };
}
