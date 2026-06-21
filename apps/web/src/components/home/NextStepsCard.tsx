'use client';

import type { LifeEventPlanV1 } from '@/lib/product-contract';
import type { ExecutionSurfaceV1 } from '@/lib/life-event-plan';
import type { ScenarioMatchV1 } from '@/lib/life-event/scenarios';
import type { RuntimeActionEffectV1 } from '@/lib/life-event/runtime';
import type { HomeLifeEventWireframeProps } from '@/lib/presentation/le-ux';
import { HomeLifeEventWireframe } from '@/lib/presentation/le-ux';

type Props = {
  plan: LifeEventPlanV1 | null;
  loading?: boolean;
  error?: string | null;
  executionSurface?: ExecutionSurfaceV1 | null;
  scenario?: ScenarioMatchV1 | null;
  runtimeEffect?: RuntimeActionEffectV1 | null;
  insight: HomeLifeEventWireframeProps['insight'];
};

export function NextStepsCard(props: Props) {
  return <HomeLifeEventWireframe {...props} />;
}
