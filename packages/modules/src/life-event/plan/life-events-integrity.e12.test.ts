import { describe, expect, it } from 'vitest';
import type { UserContextV1 } from '@arrival-atlas/product-contract';
import { buildLifeEventPlan } from './build-life-event-plan.js';
import { classifyLifeState } from './classify-life-state.js';
import { computeSituationSignals, isSatisfactionMet } from './signals.js';
import { GRAPH_CATALOG_V1 } from './graph/catalog.js';
import { resolveGraph } from './graph/resolve.js';

function ctx(partial: {
  city?: string;
  rent?: number;
  residencyStatus?: string;
  municipalRegistrationConfirmed?: boolean;
  employmentStatus?: string;
  taxClass?: 1 | 2 | 3 | 4 | 5 | 6;
  churchTax?: boolean;
  income?: number;
  insuranceType?: string;
  receivingWohngeld?: boolean;
  receivingKindergeld?: boolean;
  daysInGermany?: number;
}): UserContextV1 {
  return {
    schemaVersion: '1.0.0',
    profile: {
      schemaVersion: '1.0.0',
      preferences: {},
      completeness: { score: 40, missingDomains: [] },
      domains: {
        housing: {
          ...(partial.city ? { city: partial.city } : {}),
          ...(partial.rent !== undefined ? { monthlyColdRent: partial.rent } : {}),
        },
        migration: {
          ...(partial.residencyStatus
            ? { residencyStatus: partial.residencyStatus as never }
            : {}),
          ...(partial.municipalRegistrationConfirmed !== undefined
            ? { municipalRegistrationConfirmed: partial.municipalRegistrationConfirmed }
            : {}),
        },
        employment: {
          ...(partial.employmentStatus
            ? { employmentStatus: partial.employmentStatus as never }
            : {}),
          ...(partial.taxClass !== undefined ? { taxClass: partial.taxClass } : {}),
          ...(partial.churchTax !== undefined ? { churchTax: partial.churchTax } : {}),
        },
        income:
          partial.income !== undefined ? { grossMonthlyIncome: partial.income } : undefined,
        healthInsurance: partial.insuranceType
          ? { insuranceType: partial.insuranceType as never, hasCoverage: true }
          : undefined,
        benefits: {
          ...(partial.daysInGermany !== undefined
            ? { daysInGermany: partial.daysInGermany }
            : { daysInGermany: 45 }),
          ...(partial.receivingWohngeld !== undefined
            ? { receivingWohngeld: partial.receivingWohngeld }
            : {}),
          ...(partial.receivingKindergeld !== undefined
            ? { receivingKindergeld: partial.receivingKindergeld }
            : {}),
        },
      },
    },
  };
}

describe('E12 Life Events integrity', () => {
  it('1 — Registration cannot be blocked by Banking (catalog + resolve)', () => {
    const g1 = GRAPH_CATALOG_V1.find((graph) => graph.graphId === 'G1')!;
    const anmeldung = g1.nodes.find((node) => node.id === 'g1-complete-anmeldung')!;
    const banking = g1.nodes.find((node) => node.id === 'g1-banking-tax')!;

    expect(anmeldung.blockedByNodeIds).toEqual(['g1-secure-address']);
    expect(anmeldung.blockedByNodeIds).not.toContain('g1-banking-tax');
    expect(banking.blockedByNodeIds).toContain('g1-complete-anmeldung');

    const resolved = resolveGraph(
      g1,
      computeSituationSignals(ctx({ city: 'Berlin', residencyStatus: 'temporary-resident' }))
    );
    const anmeldungNode = resolved.nodes.find((node) => node.id === 'g1-complete-anmeldung')!;
    const bankingNode = resolved.nodes.find((node) => node.id === 'g1-banking-tax')!;
    expect(anmeldungNode.blocked).toBe(false);
    expect(bankingNode.blocked).toBe(true);
  });

  it('2 — Registration requires explicit municipal confirmation', () => {
    const signals = computeSituationSignals(
      ctx({
        city: 'Berlin',
        residencyStatus: 'eu-citizen',
        daysInGermany: 120,
      })
    );
    expect(signals.isMunicipallyRegistered).toBe(true);
    expect(isSatisfactionMet('municipal_registration', signals)).toBe(false);
  });

  it('3 — completed Registration remains completed with confirmation', () => {
    const signals = computeSituationSignals(
      ctx({
        city: 'Berlin',
        residencyStatus: 'eu-citizen',
        municipalRegistrationConfirmed: true,
        daysInGermany: 120,
      })
    );
    expect(isSatisfactionMet('municipal_registration', signals)).toBe(true);
    expect(classifyLifeState(ctx({
      city: 'Berlin',
      residencyStatus: 'eu-citizen',
      municipalRegistrationConfirmed: true,
      daysInGermany: 120,
      insuranceType: 'public',
      employmentStatus: 'employed',
      income: 3000,
      rent: 800,
    }))).not.toBe('arrival_unregistered');
  });

  it('4 — Housing rent satisfaction comes from authoritative rent fact', () => {
    expect(
      isSatisfactionMet(
        'housing_rent_recorded',
        computeSituationSignals(ctx({ city: 'Berlin' }))
      )
    ).toBe(false);
    expect(
      isSatisfactionMet(
        'housing_rent_recorded',
        computeSituationSignals(ctx({ city: 'Berlin', rent: 650 }))
      )
    ).toBe(true);
  });

  it('5 — Benefits assessed uses receipt / explicit false facts, not invention', () => {
    expect(
      isSatisfactionMet('benefits_assessed', computeSituationSignals(ctx({ city: 'Berlin' })))
    ).toBe(false);
    expect(
      isSatisfactionMet(
        'benefits_assessed',
        computeSituationSignals(ctx({ city: 'Berlin', receivingWohngeld: true }))
      )
    ).toBe(true);
  });

  it('6 — Tax unknown is not converted into false (banking_ready never invents bank)', () => {
    const signals = computeSituationSignals(
      ctx({
        city: 'Berlin',
        residencyStatus: 'eu-citizen',
        municipalRegistrationConfirmed: true,
        employmentStatus: 'employed',
        income: 2500,
        daysInGermany: 200,
      })
    );
    expect(signals.bankingEstablished).toBe(false);
    expect(isSatisfactionMet('banking_ready', signals)).toBe(false);
    expect(signals.hasMunicipalRegistrationConfirmation).toBe(true);
  });

  it('7 — Employment missing remains not employment_basis', () => {
    expect(
      isSatisfactionMet('employment_basis', computeSituationSignals(ctx({ city: 'Berlin' })))
    ).toBe(false);
  });

  it('8 — Life Events does not invent Discovery lifecycle (no discovery nodes in catalog)', () => {
    const ids = GRAPH_CATALOG_V1.flatMap((graph) => graph.nodes.map((node) => node.id));
    expect(ids.some((id) => /discovery|job-search-run|opportunity/i.test(id))).toBe(false);
    const hrefs = GRAPH_CATALOG_V1.flatMap((graph) =>
      graph.nodes.flatMap((node) => node.actions.map((action) => action.href))
    );
    expect(hrefs.some((href) => href.includes('/modules/discovery'))).toBe(false);
  });

  it('9 — action semantics: selection is separate from CTA hrefs (CTAs are navigations)', () => {
    const g1 = GRAPH_CATALOG_V1.find((graph) => graph.graphId === 'G1')!;
    const anmeldung = g1.nodes.find((node) => node.id === 'g1-complete-anmeldung')!;
    expect(anmeldung.actions.every((action) => typeof action.href === 'string' && action.href.length > 0)).toBe(
      true
    );
    expect(anmeldung.actions.some((action) => action.href.includes('prepare-anmeldung'))).toBe(true);
  });

  it('10 — mutation facts recalculate LE projection (confirmation flips Anmeldung)', () => {
    const before = buildLifeEventPlan({
      userContext: ctx({ city: 'Berlin', residencyStatus: 'temporary-resident' }),
      generatedAt: '2026-09-09T12:00:00.000Z',
    });
    const after = buildLifeEventPlan({
      userContext: ctx({
        city: 'Berlin',
        residencyStatus: 'temporary-resident',
        municipalRegistrationConfirmed: true,
      }),
      generatedAt: '2026-09-09T12:00:00.000Z',
    });
    const beforeNode = before.timeline.find((node) => node.id === 'g1-complete-anmeldung');
    const afterNode = after.timeline.find((node) => node.id === 'g1-complete-anmeldung');
    // Before confirmation: still on arrival graph with unsatisfied Anmeldung
    expect(before.currentLifeState).toBe('arrival_unregistered');
    expect(beforeNode?.satisfied).toBe(false);
    // After confirmation: leaves arrival_unregistered; Anmeldung satisfied if still in timeline
    expect(after.currentLifeState).not.toBe('arrival_unregistered');
    if (afterNode) {
      expect(afterNode.satisfied).toBe(true);
    }
  });

  it('11 — blocked Anmeldung has address prerequisite (not banking)', () => {
    const resolved = resolveGraph(
      GRAPH_CATALOG_V1.find((graph) => graph.graphId === 'G1')!,
      computeSituationSignals(ctx({}))
    );
    const anmeldung = resolved.nodes.find((node) => node.id === 'g1-complete-anmeldung')!;
    expect(anmeldung.blocked).toBe(true);
    const address = resolved.nodes.find((node) => node.id === 'g1-secure-address')!;
    expect(address.satisfied).toBe(false);
  });

  it('12 — heuristic registration alone keeps arrival_unregistered', () => {
    expect(
      classifyLifeState(
        ctx({
          city: 'Berlin',
          residencyStatus: 'eu-citizen',
          daysInGermany: 45,
        })
      )
    ).toBe('arrival_unregistered');
  });
});
