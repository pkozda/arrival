import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEMO_PERSONA_IDS,
  getDemoPersona,
  summarizeDemoPreset,
} from '@arrival-atlas/life-event-demo';
import { parseLifeEventPlanV1 } from '@arrival-atlas/product-contract';
import { buildApp } from './build-app.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from './test-state.js';

async function createSession(app: Awaited<ReturnType<typeof buildApp>>): Promise<string> {
  const sessionRes = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: { context: { userProfile: { language: 'en' } } },
  });
  return (sessionRes.json() as { sessionId: string }).sessionId;
}

function authHeaders(sessionId: string): Record<string, string> {
  return { 'x-session-id': sessionId };
}

describe('life-event demo presets API (PH-4)', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('lists canonical demo presets', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/dev/demo/presets',
      headers: authHeaders(sessionId),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { presets: Array<{ id: string }> };
    expect(body.presets.map((entry) => entry.id)).toEqual([...DEMO_PERSONA_IDS]);
  });

  for (const personaId of DEMO_PERSONA_IDS) {
    it(`load-preset ${personaId} seeds real planner output`, async () => {
      const app = await buildApp();
      const sessionId = await createSession(app);
      const persona = getDemoPersona(personaId);
      const expected = summarizeDemoPreset(personaId);

      const loadRes = await app.inject({
        method: 'POST',
        url: '/api/dev/demo/load-preset',
        headers: authHeaders(sessionId),
        payload: { presetId: personaId },
      });

      expect(loadRes.statusCode).toBe(200);
      const loaded = loadRes.json() as {
        presetId: string;
        plan: { currentLifeState: string; currentFocus: string };
        summary: { currentLifeState: string };
      };
      expect(loaded.presetId).toBe(personaId);
      expect(loaded.plan.currentLifeState).toBe(persona.expectedLifeState);
      expect(loaded.summary.currentLifeState).toBe(expected.currentLifeState);

      const planRes = await app.inject({
        method: 'GET',
        url: '/api/modules/life-event/plan',
        headers: authHeaders(sessionId),
      });

      expect(planRes.statusCode).toBe(200);
      const plan = parseLifeEventPlanV1(planRes.json());
      expect(plan.currentLifeState).toBe(persona.expectedLifeState);
      expect(plan.currentFocus.title).toBe(loaded.plan.currentFocus);
    });
  }

  it('rejects unknown preset ids', async () => {
    const app = await buildApp();
    const sessionId = await createSession(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/dev/demo/load-preset',
      headers: authHeaders(sessionId),
      payload: { presetId: 'unknown-persona' },
    });

    expect(res.statusCode).toBe(400);
  });
});
