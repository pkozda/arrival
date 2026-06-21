import { buildLifeEventPlan, CLASSIFIER_FIXTURES } from '@arrival-atlas/modules/life-event';
import type { LifeEventPlanV1, UserContextV1 } from '@arrival-atlas/product-contract';
import { DEMO_FIXED_GENERATED_AT } from './constants.js';
import {
  getDemoPersona,
  type DemoPersonaId,
  type LifeEventDemoPersona,
} from './personas.js';

export type DemoPresetSummary = {
  personaId: DemoPersonaId;
  fixtureId: string;
  expectedLifeState: LifeEventDemoPersona['expectedLifeState'];
  currentLifeState: LifeEventDemoPersona['expectedLifeState'];
  planningSeverity: LifeEventPlanV1['planningSeverity'];
  currentFocusTitle: string;
  nextActionTitles: string[];
  blockerTitles: string[];
  secondaryConditions: LifeEventPlanV1['secondaryConditions'];
  planConfidence: LifeEventPlanV1['reasoning']['planConfidence'];
};

export function resolveDemoUserContext(personaId: DemoPersonaId): UserContextV1 {
  const persona = getDemoPersona(personaId);
  const fixture = CLASSIFIER_FIXTURES.find((entry) => entry.id === persona.fixtureId);
  if (!fixture) {
    throw new Error(`Fixture ${persona.fixtureId} not found for persona ${personaId}`);
  }
  return fixture.userContext;
}

export function buildDemoPlan(personaId: DemoPersonaId): LifeEventPlanV1 {
  return buildLifeEventPlan({
    userContext: resolveDemoUserContext(personaId),
    generatedAt: DEMO_FIXED_GENERATED_AT,
  });
}

export function summarizeDemoPreset(personaId: DemoPersonaId): DemoPresetSummary {
  const persona = getDemoPersona(personaId);
  const plan = buildDemoPlan(personaId);

  return {
    personaId,
    fixtureId: persona.fixtureId,
    expectedLifeState: persona.expectedLifeState,
    currentLifeState: plan.currentLifeState,
    planningSeverity: plan.planningSeverity,
    currentFocusTitle: plan.currentFocus.title,
    nextActionTitles: plan.nextBestActions.slice(0, 3).map((node) => node.title),
    blockerTitles: plan.activeBlocks.slice(0, 3).map((node) => node.title),
    secondaryConditions: plan.secondaryConditions,
    planConfidence: plan.reasoning.planConfidence,
  };
}
