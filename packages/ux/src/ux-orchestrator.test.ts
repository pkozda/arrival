import { describe, it, expect } from 'vitest';
import { buildUXActionPlan } from './ux-orchestrator.js';

describe('buildUXActionPlan', () => {
  it('maps financial-reality Anmeldung signal to a high-priority card', () => {
    const plan = buildUXActionPlan([
      {
        domain: 'financial-reality',
        result: {
          rule: 'anmeldung_required',
          daysInGermany: 90,
        },
      },
    ]);

    expect(plan.signals).toEqual([
      expect.objectContaining({
        domain: 'financial-reality',
        ruleId: 'anmeldung_required',
        severity: 'critical',
      }),
    ]);

    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toEqual({
      id: 'anmeldung',
      title: 'Register your address (Anmeldung)',
      description:
        'You should register at the Bürgeramt as soon as possible based on your stay duration.',
      priority: 'high',
      source: 'financial-reality',
    });
  });

  it('generates a healthcare card when insurance is missing', () => {
    const plan = buildUXActionPlan([
      {
        domain: 'healthcare-navigation',
        result: {
          status: 'no_insurance',
        },
      },
    ]);

    expect(plan.signals).toEqual([
      expect.objectContaining({
        domain: 'healthcare-navigation',
        ruleId: 'no_insurance',
        severity: 'warning',
      }),
    ]);

    expect(plan.actions[0]).toMatchObject({
      id: 'choose-insurance',
      title: 'Choose health insurance provider',
      priority: 'high',
      source: 'healthcare-navigation',
    });
  });

  it('does not generate a healthcare card when insurance is confirmed', () => {
    const plan = buildUXActionPlan([
      {
        domain: 'healthcare-navigation',
        result: {
          status: 'insurance_confirmed',
        },
      },
    ]);

    expect(plan.signals).toEqual([]);
    expect(plan.actions).toEqual([]);
    expect(plan.summary).toBe('No urgent actions identified at this time.');
  });

  it('prioritizes mixed module outputs in legal → financial → healthcare order', () => {
    const plan = buildUXActionPlan([
      {
        domain: 'system-translation',
        result: {
          requested: true,
          results: [{ term: 'Anmeldung' }],
        },
      },
      {
        domain: 'healthcare-navigation',
        result: {
          status: 'no_insurance',
        },
      },
      {
        domain: 'financial-reality',
        result: {
          rule: 'anmeldung_required',
          daysInGermany: 90,
        },
      },
      {
        domain: 'financial-reality',
        result: {
          decisions: [
            {
              title: 'Potential Bürgergeld eligibility',
              action: 'Contact local Jobcenter for Beratungsgespräch',
            },
          ],
        },
      },
    ]);

    expect(plan.actions.map((action) => action.id)).toEqual([
      'anmeldung',
      'choose-insurance',
      'buergergeld',
      'translation-info',
    ]);

    expect(plan.signals.map((signal) => signal.ruleId)).toEqual([
      'anmeldung_required',
      'no_insurance',
      'buergergeld_eligible',
      'term_lookup',
    ]);
  });

  it('builds summary from highest-priority actions only', () => {
    const plan = buildUXActionPlan([
      {
        domain: 'financial-reality',
        result: {
          rule: 'anmeldung_required',
          daysInGermany: 90,
        },
      },
      {
        domain: 'financial-reality',
        result: {
          rule: 'krankenkasse_required',
        },
      },
      {
        domain: 'financial-reality',
        result: {
          decisions: [
            {
              title: 'Rent exceeds net income',
              action: 'Apply for Wohngeld at local Wohngeldstelle',
            },
          ],
        },
      },
      {
        domain: 'system-translation',
        result: {
          requested: true,
          results: [{ term: 'Bürgergeld' }],
        },
      },
    ]);

    expect(plan.summary).toBe(
      'You should register your address at the Bürgeramt and confirm your health insurance. These are your most urgent administrative steps in Germany.'
    );
    expect(plan.summary).not.toContain('Wohngeld');
    expect(plan.summary).not.toContain('translation');
  });

  it('parses real financial-reality adminRules output shape', () => {
    const plan = buildUXActionPlan([
      {
        domain: 'financial-reality',
        result: {
          adminRules: [
            'You must register (Anmeldung) at the Bürgeramt within 14 days of moving',
            'Book an appointment at your local Bürgeramt and bring passport, rental contract, and Wohnungsgeberbestätigung',
          ],
        },
      },
    ]);

    expect(plan.actions[0]?.id).toBe('anmeldung');
    expect(plan.actions[0]?.priority).toBe('high');
  });

  it('deduplicates overlapping insurance actions from financial and healthcare modules', () => {
    const plan = buildUXActionPlan([
      {
        domain: 'financial-reality',
        result: {
          rule: 'krankenkasse_required',
        },
      },
      {
        domain: 'healthcare-navigation',
        result: {
          status: 'no_insurance',
        },
      },
    ]);

    expect(plan.actions.map((action) => action.id)).toEqual(['krankenkasse']);
  });
});
