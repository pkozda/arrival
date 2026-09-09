import { describe, expect, it } from 'vitest';
import type { UserProfileViewV1 } from '@arrival-atlas/product-contract';
import {
  evaluateBenefitsAwareness,
  evaluateKindergeldAwareness,
  evaluateWohngeldAwareness,
} from './index.js';

function baseProfile(overrides: Partial<UserProfileViewV1['domains']> = {}): UserProfileViewV1 {
  return {
    schemaVersion: '1.0.0',
    preferences: {},
    completeness: { score: 0, missingDomains: [] },
    domains: {
      ...overrides,
    },
  } as UserProfileViewV1;
}

describe('E5 Kindergeld awareness', () => {
  it('A — NOT_ENOUGH_INFORMATION when children facts are absent', () => {
    const result = evaluateKindergeldAwareness(
      baseProfile({ household: { householdSize: 3 } })
    );
    expect(result.state).toBe('NOT_ENOUGH_INFORMATION');
    expect(result.missingFieldKeys).toContain('benefits.awareness.missing.children');
    expect(result.nextAction.kind).toBe('update_household');
    expect(result.nextAction.href).toContain('household-family');
    expect(result.explanationKey).not.toMatch(/eligible|qualify/i);
  });

  it('A2 — household size alone never implies children', () => {
    const result = evaluateKindergeldAwareness(
      baseProfile({ household: { householdSize: 5, maritalStatus: 'married' } })
    );
    expect(result.state).toBe('NOT_ENOUGH_INFORMATION');
    expect(result.engine.heuristicMatch).toBe(false);
  });

  it('B — READY_TO_ACT when explicit children are present', () => {
    const result = evaluateKindergeldAwareness(
      baseProfile({
        household: { householdSize: 3, children: [{ age: 7 }] },
      })
    );
    expect(result.state).toBe('READY_TO_ACT');
    expect(result.engine.heuristicMatch).toBe(true);
    expect(result.nextAction.kind).toBe('open_official_source');
    expect(result.nextAction.href).toMatch(/kindergeld/i);
    expect(result.explanationKey).toBe('benefits.awareness.kindergeld.readyToAct');
  });

  it('C — NOT_APPLICABLE when children is an explicit empty array', () => {
    const result = evaluateKindergeldAwareness(
      baseProfile({
        household: { householdSize: 2, children: [] },
      })
    );
    expect(result.state).toBe('NOT_APPLICABLE');
    expect(result.engine.heuristicMatch).toBe(false);
  });

  it('D — children alone do not produce COMPLETED', () => {
    const result = evaluateKindergeldAwareness(
      baseProfile({
        household: { children: [{ age: 4 }] },
        benefits: { receivingWohngeld: true },
      })
    );
    expect(result.state).not.toBe('COMPLETED');
    expect(result.state).toBe('READY_TO_ACT');
  });

  it('E — recalculation when children facts change', () => {
    const before = evaluateKindergeldAwareness(baseProfile({ household: { householdSize: 2 } }));
    const after = evaluateKindergeldAwareness(
      baseProfile({ household: { householdSize: 2, children: [{ age: 0 }, { age: 0 }] } })
    );
    expect(before.state).toBe('NOT_ENOUGH_INFORMATION');
    expect(after.state).toBe('READY_TO_ACT');
  });

  it('F — persistence: same facts reconstruct the same awareness', () => {
    const profile = baseProfile({ household: { children: [{ age: 10 }] } });
    const first = evaluateKindergeldAwareness(profile);
    const second = evaluateKindergeldAwareness(structuredClone(profile));
    expect(first).toEqual(second);
  });

  it('G — Wohngeld regression: Kindergeld facts do not alter Wohngeld semantics', () => {
    const profile = baseProfile({
      housing: { city: 'Berlin', monthlyColdRent: 650 },
      income: { grossMonthlyIncome: 1800 },
      household: { children: [{ age: 5 }] },
    });
    const wohngeld = evaluateWohngeldAwareness(profile);
    expect(wohngeld.state).toBe('READY_TO_ACT');
    expect(wohngeld.benefitId).toBe('de_federal_wohngeld');

    const bundle = evaluateBenefitsAwareness(profile);
    expect(bundle).toHaveLength(2);
    expect(bundle[0]?.benefitId).toBe('de_federal_wohngeld');
    expect(bundle[1]?.benefitId).toBe('de_federal_kindergeld');
    expect(bundle[1]?.state).toBe('READY_TO_ACT');
  });
});

describe('E6 Kindergeld completion fact', () => {
  it('A — undefined receivingKindergeld leaves awareness unchanged', () => {
    const withChildren = evaluateKindergeldAwareness(
      baseProfile({ household: { children: [{ age: 6 }] } })
    );
    const withUndefinedFlag = evaluateKindergeldAwareness(
      baseProfile({
        household: { children: [{ age: 6 }] },
        benefits: { receivingKindergeld: undefined },
      })
    );
    expect(withChildren.state).toBe('READY_TO_ACT');
    expect(withUndefinedFlag.state).toBe('READY_TO_ACT');
  });

  it('B — false continues normal awareness evaluation', () => {
    const missing = evaluateKindergeldAwareness(
      baseProfile({
        household: { householdSize: 3 },
        benefits: { receivingKindergeld: false },
      })
    );
    expect(missing.state).toBe('NOT_ENOUGH_INFORMATION');

    const ready = evaluateKindergeldAwareness(
      baseProfile({
        household: { children: [{ age: 3 }] },
        benefits: { receivingKindergeld: false },
      })
    );
    expect(ready.state).toBe('READY_TO_ACT');
  });

  it('C — true → COMPLETED', () => {
    const result = evaluateKindergeldAwareness(
      baseProfile({
        household: { children: [{ age: 8 }] },
        benefits: { receivingKindergeld: true },
      })
    );
    expect(result.state).toBe('COMPLETED');
    expect(result.explanationKey).toBe('benefits.awareness.kindergeld.completed');
    expect(result.nextAction.kind).toBe('update_benefits_flags');
    expect(result.nextAction.href).toContain('benefits-support');
    expect(result.nextAction.kind).not.toBe('open_official_source');
  });

  it('D — children / household size / child count never imply COMPLETED', () => {
    expect(
      evaluateKindergeldAwareness(baseProfile({ household: { children: [{ age: 1 }] } })).state
    ).not.toBe('COMPLETED');
    expect(
      evaluateKindergeldAwareness(baseProfile({ household: { householdSize: 4 } })).state
    ).not.toBe('COMPLETED');
    expect(
      evaluateKindergeldAwareness(
        baseProfile({ household: { children: [{ age: 0 }, { age: 0 }, { age: 0 }] } })
      ).state
    ).not.toBe('COMPLETED');
  });

  it('E — recalculation false → true → false', () => {
    const children = { children: [{ age: 5 }] };
    const off = evaluateKindergeldAwareness(
      baseProfile({ household: children, benefits: { receivingKindergeld: false } })
    );
    const on = evaluateKindergeldAwareness(
      baseProfile({ household: children, benefits: { receivingKindergeld: true } })
    );
    const offAgain = evaluateKindergeldAwareness(
      baseProfile({ household: children, benefits: { receivingKindergeld: false } })
    );
    expect(off.state).toBe('READY_TO_ACT');
    expect(on.state).toBe('COMPLETED');
    expect(offAgain.state).toBe('READY_TO_ACT');
  });

  it('F — persistence reconstructs COMPLETED from authoritative fact', () => {
    const profile = baseProfile({
      household: { children: [{ age: 2 }] },
      benefits: { receivingKindergeld: true },
    });
    const first = evaluateKindergeldAwareness(profile);
    const second = evaluateKindergeldAwareness(structuredClone(profile));
    expect(first.state).toBe('COMPLETED');
    expect(second).toEqual(first);
  });

  it('G — ownership isolation: distinct profiles do not share completion', () => {
    const alice = evaluateKindergeldAwareness(
      baseProfile({ benefits: { receivingKindergeld: true } })
    );
    const bob = evaluateKindergeldAwareness(
      baseProfile({ household: { children: [{ age: 4 }] } })
    );
    expect(alice.state).toBe('COMPLETED');
    expect(bob.state).toBe('READY_TO_ACT');
  });

  it('I — Wohngeld completion regression', () => {
    const profile = baseProfile({
      housing: { monthlyColdRent: 600 },
      income: { grossMonthlyIncome: 1500 },
      household: { children: [{ age: 4 }] },
      benefits: { receivingWohngeld: true, receivingKindergeld: true },
    });
    const wohngeld = evaluateWohngeldAwareness(profile);
    const kindergeld = evaluateKindergeldAwareness(profile);
    expect(wohngeld.state).toBe('COMPLETED');
    expect(kindergeld.state).toBe('COMPLETED');
    expect(wohngeld.benefitId).toBe('de_federal_wohngeld');
    expect(kindergeld.benefitId).toBe('de_federal_kindergeld');
  });

  it('J — shared panel bundle still returns both cards', () => {
    const bundle = evaluateBenefitsAwareness(
      baseProfile({
        housing: { monthlyColdRent: 500 },
        income: { grossMonthlyIncome: 1200 },
        household: { children: [{ age: 1 }] },
        benefits: { receivingKindergeld: true },
      })
    );
    expect(bundle).toHaveLength(2);
    expect(bundle.map((b) => b.benefitId)).toEqual([
      'de_federal_wohngeld',
      'de_federal_kindergeld',
    ]);
    expect(bundle[1]?.state).toBe('COMPLETED');
  });
});
