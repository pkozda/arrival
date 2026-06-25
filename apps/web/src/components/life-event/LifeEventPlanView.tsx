'use client';

import type { ReactNode } from 'react';
import type { LifeEventPlanV1 } from '@/lib/product-contract';
import type { ExecutionSurfaceV1 } from '@/lib/life-event-plan';
import type { ScenarioMatchV1 } from '@/lib/life-event/scenarios';
import { ModuleLifeEventWireframe } from '@/lib/presentation/le-ux';

type Props = {
  plan: LifeEventPlanV1;
  executionSurface?: ExecutionSurfaceV1 | null;
  scenario?: ScenarioMatchV1 | null;
  scenarioExplorer?: ReactNode;
  scenarioExplorerDefaultOpen?: boolean;
};

export function LifeEventPlanView({
  plan,
  executionSurface,
  scenario,
  scenarioExplorer,
  scenarioExplorerDefaultOpen = false,
}: Props) {
  return (
    <>
      <ModuleLifeEventWireframe plan={plan} executionSurface={executionSurface} scenario={scenario} />

      {scenarioExplorer && (
        <details className="le-galaxy-hud le-galaxy-hud--explorer" open={scenarioExplorerDefaultOpen}>
          <summary className="le-galaxy-hud__explorer-toggle">Scenarios</summary>
          <div className="le-galaxy-hud__explorer-body">{scenarioExplorer}</div>
        </details>
      )}
    </>
  );
}
