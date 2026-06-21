import type { LifeStateId } from '@arrival-atlas/product-contract';

export const DEMO_PERSONA_IDS = [
  'new-arrival',
  'job-loss',
  'benefits-discovery',
  'stable-resident',
] as const;

export type DemoPersonaId = (typeof DEMO_PERSONA_IDS)[number];

export type LifeEventDemoPersona = {
  id: DemoPersonaId;
  title: string;
  tagline: string;
  goal: string;
  valueProposition: string;
  /** Canonical classifier fixture — real planner input, not mocked output. */
  fixtureId: string;
  expectedLifeState: LifeStateId;
  /** Optional scenario overlay for explorer walkthroughs (LE-7 presentation). */
  scenarioEvent?: string;
  recommendedFocus: string;
};

export const LIFE_EVENT_DEMO_PERSONAS: readonly LifeEventDemoPersona[] = [
  {
    id: 'new-arrival',
    title: 'Persona A — New Arrival',
    tagline: 'I just arrived. What should I do first?',
    goal: 'Demonstrate onboarding and registration guidance.',
    valueProposition: 'Turns first-week chaos into a single prioritized next step.',
    fixtureId: 'F01',
    expectedLifeState: 'arrival_unregistered',
    scenarioEvent: 'new_arrival',
    recommendedFocus: 'Complete Anmeldung and establish legal residence.',
  },
  {
    id: 'job-loss',
    title: 'Persona B — Job Loss',
    tagline: 'I lost my job. What happens next?',
    goal: 'Demonstrate adaptive planning after disruption.',
    valueProposition: 'Re-prioritizes survival and benefits steps when income stops.',
    fixtureId: 'F04',
    expectedLifeState: 'economic_setup_pending',
    scenarioEvent: 'job_loss',
    recommendedFocus: 'Stabilize income and register with the employment agency.',
  },
  {
    id: 'benefits-discovery',
    title: 'Persona C — Benefits Discovery',
    tagline: 'Am I eligible for assistance?',
    goal: 'Demonstrate support awareness.',
    valueProposition: 'Surfaces housing and social benefits without a separate checklist.',
    fixtureId: 'F08',
    expectedLifeState: 'benefits_exploration',
    scenarioEvent: 'benefits_trigger',
    recommendedFocus: 'Check Wohngeld and related housing support eligibility.',
  },
  {
    id: 'stable-resident',
    title: 'Persona D — Stable Resident',
    tagline: 'What should I prepare for next?',
    goal: 'Demonstrate proactive planning.',
    valueProposition: 'Keeps long-term residents ahead of life transitions.',
    fixtureId: 'F10',
    expectedLifeState: 'situation_stable',
    scenarioEvent: 'stability_restore',
    recommendedFocus: 'Review optimization opportunities and upcoming transitions.',
  },
] as const;

export function getDemoPersona(id: DemoPersonaId): LifeEventDemoPersona {
  const persona = LIFE_EVENT_DEMO_PERSONAS.find((entry) => entry.id === id);
  if (!persona) {
    throw new Error(`Unknown demo persona: ${id}`);
  }
  return persona;
}

export function isDemoPersonaId(value: string): value is DemoPersonaId {
  return (DEMO_PERSONA_IDS as readonly string[]).includes(value);
}
