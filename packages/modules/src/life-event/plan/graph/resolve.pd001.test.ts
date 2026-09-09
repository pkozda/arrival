import { describe, expect, it } from 'vitest';
import type { UserContextV1 } from '@arrival-atlas/product-contract';
import { computeSituationSignals } from '../signals.js';
import { GRAPH_CATALOG_V1 } from './catalog.js';
import { resolveGraph } from './resolve.js';

function context(partial: {
  city?: string;
  municipalRegistrationConfirmed?: boolean;
}): UserContextV1 {
  return {
    schemaVersion: '1.0.0',
    profile: {
      schemaVersion: '1.0.0',
      preferences: {},
      completeness: { score: 0, missingDomains: [] },
      domains: {
        housing: partial.city ? { city: partial.city } : undefined,
        migration: {
          residencyStatus: 'temporary-resident',
          ...(partial.municipalRegistrationConfirmed !== undefined
            ? { municipalRegistrationConfirmed: partial.municipalRegistrationConfirmed }
            : {}),
        },
        benefits: { daysInGermany: 45 },
      },
    },
  };
}

const g1 = GRAPH_CATALOG_V1.find((graph) => graph.graphId === 'G1')!;

describe('PD-001 G1 registration graph states', () => {
  it('blocks Anmeldung when address is missing', () => {
    const resolved = resolveGraph(g1, computeSituationSignals(context({})));
    const address = resolved.nodes.find((node) => node.id === 'g1-secure-address')!;
    const anmeldung = resolved.nodes.find((node) => node.id === 'g1-complete-anmeldung')!;

    expect(address.satisfied).toBe(false);
    expect(anmeldung.satisfied).toBe(false);
    expect(anmeldung.blocked).toBe(true);
  });

  it('makes Anmeldung actionable with address but not COMPLETE without confirmation', () => {
    const resolved = resolveGraph(
      g1,
      computeSituationSignals(context({ city: 'Bremen' }))
    );
    const address = resolved.nodes.find((node) => node.id === 'g1-secure-address')!;
    const anmeldung = resolved.nodes.find((node) => node.id === 'g1-complete-anmeldung')!;

    expect(address.satisfied).toBe(true);
    expect(anmeldung.blocked).toBe(false);
    expect(anmeldung.satisfied).toBe(false);
  });

  it('marks Anmeldung COMPLETE with address + explicit confirmation', () => {
    const resolved = resolveGraph(
      g1,
      computeSituationSignals(
        context({ city: 'Bremen', municipalRegistrationConfirmed: true })
      )
    );
    const anmeldung = resolved.nodes.find((node) => node.id === 'g1-complete-anmeldung')!;

    expect(anmeldung.blocked).toBe(false);
    expect(anmeldung.satisfied).toBe(true);
  });
});
