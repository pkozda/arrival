import type { LifeEventPlanV1 } from '@/lib/product-contract';
import type { ExecutionSurfaceV1 } from '@/lib/life-event-plan';

export function shouldShowLifeEventColdStart(input: {
  plan: LifeEventPlanV1 | null;
  planLoading: boolean;
  executionSurface: ExecutionSurfaceV1 | null | undefined;
}): boolean {
  if (input.planLoading) {
    return false;
  }

  if (input.plan) {
    return false;
  }

  return input.executionSurface == null;
}

export function defaultScenarioExplorerOpen(input: {
  hasPlan: boolean;
  mode: string | null | undefined;
}): boolean {
  return input.mode === 'scenarios';
}

export function shouldHideHomeSecondarySections(input: {
  planLoading: boolean;
  showPlanCard: boolean;
  showColdStart: boolean;
}): boolean {
  return input.planLoading || input.showPlanCard || input.showColdStart;
}

export function homeHasMeaningfulLifeEventState(input: {
  planLoading: boolean;
  showPlanCard: boolean;
  showColdStart: boolean;
}): boolean {
  return input.planLoading || input.showPlanCard || input.showColdStart;
}

export function scenarioExplorerPanelLabelIncludesSimulation(
  label: string,
  simulationMarker: string
): boolean {
  return label.toLowerCase().includes(simulationMarker.toLowerCase());
}
