import { describe, expect, it } from 'vitest';
import {
  distributeOrbitAngles,
  GALAXY_CENTER,
  galaxyEdgePath,
  layoutGalaxyGraphNodes,
} from '@/lib/presentation/spatial-core';

describe('distributeOrbitAngles', () => {
  it('spreads angles from bottom through left to top', () => {
    const angles = distributeOrbitAngles(5);
    expect(angles[0]).toBeGreaterThanOrEqual(50);
    expect(angles.at(-1)).toBeLessThanOrEqual(310);
    expect(Math.min(...angles)).toBeLessThan(120);
    expect(Math.max(...angles)).toBeGreaterThan(240);
  });
});

describe('layoutGalaxyGraphNodes', () => {
  it('places journey at the center and satellites around the full orbit', () => {
    const nodes = layoutGalaxyGraphNodes({
      primary: {
        id: 'primary',
        status: 'recommended',
        payload: { id: 'primary', title: 'Primary', actions: [], blocked: false, satisfied: false },
      },
      blocked: [
        {
          id: 'blocked',
          status: 'blocked',
          payload: { id: 'blocked', title: 'Blocked', actions: [], blocked: true, satisfied: false },
        },
      ],
      completed: [
        {
          id: 'done',
          status: 'completed',
          payload: { id: 'done', title: 'Done', actions: [], blocked: false, satisfied: true },
        },
      ],
      secondary: [
        {
          id: 'secondary',
          status: 'recommended',
          payload: { id: 'secondary', title: 'Secondary', actions: [], blocked: false, satisfied: false },
        },
      ],
      contextual: [
        {
          id: 'future',
          status: 'future',
          payload: { id: 'future', title: 'Future', actions: [], blocked: false, satisfied: false },
        },
      ],
    });

    const journey = nodes.find((node) => node.id === '__journey__');
    const satellites = nodes.filter((node) => node.id !== '__journey__');
    const yValues = satellites.map((node) => node.y);

    expect(journey).toMatchObject({ x: GALAXY_CENTER.x, y: GALAXY_CENTER.y });
    expect(satellites.length).toBe(5);
    expect(Math.min(...yValues)).toBeGreaterThanOrEqual(14);
    expect(Math.max(...yValues)).toBeLessThanOrEqual(86);
  });
});

describe('galaxyEdgePath', () => {
  it('returns a curved SVG path between two points', () => {
    const path = galaxyEdgePath({ x: 10, y: 50 }, { x: 90, y: 50 });
    expect(path.startsWith('M 10 50 Q')).toBe(true);
    expect(path.endsWith('90 50')).toBe(true);
  });
});
