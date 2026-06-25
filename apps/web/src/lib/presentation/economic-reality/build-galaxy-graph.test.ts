import { describe, expect, it } from 'vitest';
import { buildEconomicRealityPlan, ECONOMIC_FIXTURES } from '@arrival-atlas/modules/economic-reality';
import { adaptPresentationToUi } from '@/lib/economic-reality';
import { buildEconomicRealityGalaxyGraph } from './build-galaxy-graph';

const FIXED_META = {
  requestId: 'req_er_galaxy_test',
  generatedAt: '2026-06-21T12:00:00.000Z',
};

describe('buildEconomicRealityGalaxyGraph', () => {
  it('maps EF03 presentation cards into a spatial graph with journey anchor', () => {
    const fixture = ECONOMIC_FIXTURES.find((entry) => entry.id === 'EF03')!;
    const response = buildEconomicRealityPlan(fixture.userContext, FIXED_META);
    const sections = adaptPresentationToUi(response.presentation);
    const { graphNodes, graphEdges, primaryFocusCardId } = buildEconomicRealityGalaxyGraph({
      presentation: response.presentation,
      sections,
    });

    const journey = graphNodes.find((node) => node.id === '__journey__');
    const satellites = graphNodes.filter((node) => node.id !== '__journey__');

    expect(journey).toMatchObject({ status: 'core' });
    expect(satellites.length).toBeGreaterThan(0);
    expect(primaryFocusCardId).toBeTruthy();
    expect(graphEdges.some((edge) => edge.from === '__journey__' && edge.type === 'unlock')).toBe(true);
  });
});
