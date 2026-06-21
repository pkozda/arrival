import { describe, expect, it } from 'vitest';
import { CLASSIFIER_FIXTURES } from '@arrival-atlas/modules/life-event';
import {
  DEMO_PERSONA_IDS,
  buildDemoPlan,
  getDemoPersona,
  summarizeDemoPreset,
} from '@arrival-atlas/life-event-demo';

describe('life-event demo presets (PH-4)', () => {
  for (const personaId of DEMO_PERSONA_IDS) {
    it(`${personaId} uses a real fixture and matches expected life state`, () => {
      const persona = getDemoPersona(personaId);
      const fixture = CLASSIFIER_FIXTURES.find((entry) => entry.id === persona.fixtureId);
      expect(fixture).toBeDefined();
      expect(fixture!.expectedPrimary).toBe(persona.expectedLifeState);

      const plan = buildDemoPlan(personaId);
      expect(plan.currentLifeState).toBe(persona.expectedLifeState);
      expect(plan.currentFocus.title.length).toBeGreaterThan(0);
      expect(plan.timeline.length).toBeGreaterThan(0);
    });

    it(`${personaId} summary is stable for showcase scripts`, () => {
      const summary = summarizeDemoPreset(personaId);
      expect(summary.currentLifeState).toBe(summary.expectedLifeState);
      expect(summary.currentFocusTitle.length).toBeGreaterThan(0);
    });
  }

  it('all personas map to unique fixtures', () => {
    const fixtureIds = DEMO_PERSONA_IDS.map((id) => getDemoPersona(id).fixtureId);
    expect(new Set(fixtureIds).size).toBe(fixtureIds.length);
  });
});
