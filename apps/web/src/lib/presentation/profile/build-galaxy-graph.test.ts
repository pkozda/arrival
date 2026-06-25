import { describe, expect, it } from 'vitest';
import { ECONOMIC_FIXTURES } from '@arrival-atlas/modules/economic-reality';
import { CLASSIFIER_FIXTURES } from '@arrival-atlas/modules/life-event';
import { buildProfileGalaxyGraph } from './build-galaxy-graph';

const TEST_SNAPSHOT = {
  schemaVersion: '1.0.0' as const,
  session: {
    sessionId: 'sess_test',
    language: 'en' as const,
    uiPreferences: { theme: 'system' as const },
  },
  executionsByModuleId: {},
  situationSummary: null,
};

describe('buildProfileGalaxyGraph', () => {
  it('maps life-event fixture profile domains into a spatial identity graph', () => {
    const fixture = CLASSIFIER_FIXTURES[0]!;
    const profile = fixture.userContext.profile;

    const { graphNodes, graphEdges, primaryFocusDomainSlug } = buildProfileGalaxyGraph({
      uiSnapshot: TEST_SNAPSHOT,
      modules: [],
      profile,
      profileInsights: null,
    });

    const journey = graphNodes.find((node) => node.id === '__journey__');
    const satellites = graphNodes.filter((node) => node.id !== '__journey__');

    expect(journey).toMatchObject({ status: 'core' });
    expect(satellites.length).toBe(7);
    expect(primaryFocusDomainSlug).toBeTruthy();
    expect(graphEdges.some((edge) => edge.from === '__journey__' && edge.type === 'unlock')).toBe(true);
  });

  it('adds dependency edges toward benefits-support when upstream domains are incomplete', () => {
    const fixture = ECONOMIC_FIXTURES.find((entry) => entry.id === 'EF03')!;
    const profile = fixture.userContext.profile;

    const { graphEdges } = buildProfileGalaxyGraph({
      uiSnapshot: TEST_SNAPSHOT,
      modules: [],
      profile,
      profileInsights: null,
    });

    expect(
      graphEdges.some((edge) => edge.to === 'benefits-support' && edge.type === 'dependency')
    ).toBe(true);
  });

  it('marks a complete primary focus domain as completed instead of recommended', () => {
    const fixture = CLASSIFIER_FIXTURES[0]!;
    const profile = fixture.userContext.profile;

    const { graphNodes } = buildProfileGalaxyGraph({
      uiSnapshot: TEST_SNAPSHOT,
      modules: [],
      profile,
      profileInsights: null,
    });

    graphNodes
      .filter((node) => node.id !== '__journey__')
      .forEach((node) => {
        const payload = node.payload as { domain: { status: string } } | null;
        if (payload?.domain.status === 'complete') {
          expect(node.status).toBe('completed');
        }
      });
  });

  it('does not emit duplicate dependency edge ids', () => {
    const fixture = ECONOMIC_FIXTURES.find((entry) => entry.id === 'EF03')!;
    const profile = fixture.userContext.profile;

    const { graphEdges } = buildProfileGalaxyGraph({
      uiSnapshot: TEST_SNAPSHOT,
      modules: [],
      profile,
      profileInsights: null,
    });

    const edgeIds = graphEdges.map((edge) => edge.id);
    expect(edgeIds.length).toBe(new Set(edgeIds).size);
  });
});
