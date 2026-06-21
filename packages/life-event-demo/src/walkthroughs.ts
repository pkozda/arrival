import type { DemoPresetSummary } from './presets.js';
import { summarizeDemoPreset } from './presets.js';
import {
  DEMO_PERSONA_IDS,
  getDemoPersona,
  type DemoPersonaId,
} from './personas.js';

export type DemoWalkthroughStep = {
  label: string;
  detail: string;
};

export type DemoWalkthrough = {
  personaId: DemoPersonaId;
  title: string;
  durationMinutes: string;
  startingSituation: string;
  currentState: string;
  recommendedFocus: string;
  blockers: string[];
  nextActions: string[];
  outcome: string;
  routes: {
    home: string;
    module: string;
    explorer?: string;
  };
  steps: DemoWalkthroughStep[];
};

function buildWalkthrough(personaId: DemoPersonaId, summary: DemoPresetSummary): DemoWalkthrough {
  const persona = getDemoPersona(personaId);
  const moduleRoute = persona.scenarioEvent
    ? `/modules/life-event?event=${persona.scenarioEvent}`
    : '/modules/life-event';
  const explorerRoute = persona.scenarioEvent
    ? `/modules/life-event?event=${persona.scenarioEvent}#explorer`
    : '/modules/life-event#explorer';

  return {
    personaId,
    title: persona.title,
    durationMinutes: '2–3',
    startingSituation: persona.tagline,
    currentState: summary.currentLifeState,
    recommendedFocus: summary.currentFocusTitle || persona.recommendedFocus,
    blockers: summary.blockerTitles.length > 0 ? summary.blockerTitles : ['No active blockers in this preset.'],
    nextActions:
      summary.nextActionTitles.length > 0
        ? summary.nextActionTitles
        : [summary.currentFocusTitle],
    outcome: persona.valueProposition,
    routes: {
      home: '/',
      module: moduleRoute,
      explorer: explorerRoute,
    },
    steps: [
      {
        label: 'Set the scene',
        detail: `Open Home after loading preset "${personaId}". Explain: "${persona.tagline}"`,
      },
      {
        label: 'Show the plan',
        detail: `Point to the active life-event plan — state is ${summary.currentLifeState} with ${summary.planningSeverity} severity.`,
      },
      {
        label: 'Highlight focus',
        detail: `Current focus: "${summary.currentFocusTitle}". This is the one thing to do now.`,
      },
      {
        label: 'Acknowledge blockers',
        detail:
          summary.blockerTitles.length > 0
            ? `Active blockers: ${summary.blockerTitles.join('; ')}.`
            : 'No hard blockers — emphasize forward-looking preparation.',
      },
      {
        label: 'Next actions',
        detail: `Walk through next steps: ${(summary.nextActionTitles.length > 0 ? summary.nextActionTitles : [summary.currentFocusTitle]).join(' → ')}.`,
      },
      {
        label: 'Close with value',
        detail: persona.valueProposition,
      },
    ],
  };
}

export const LIFE_EVENT_DEMO_WALKTHROUGHS: readonly DemoWalkthrough[] = DEMO_PERSONA_IDS.map(
  (personaId) => buildWalkthrough(personaId, summarizeDemoPreset(personaId))
);

export function getDemoWalkthrough(personaId: DemoPersonaId): DemoWalkthrough {
  const walkthrough = LIFE_EVENT_DEMO_WALKTHROUGHS.find((entry) => entry.personaId === personaId);
  if (!walkthrough) {
    throw new Error(`No walkthrough for persona ${personaId}`);
  }
  return walkthrough;
}
