import { describe, expect, it } from 'vitest';
import type { ModuleUIProjection } from '../ModuleUIProjection.js';
import { projectActionCards } from './projectActionCards.js';

function projection(
  moduleId: string,
  actions: ModuleUIProjection['actions']
): ModuleUIProjection {
  return {
    moduleId,
    title: moduleId,
    status: 'success',
    recommendations: [],
    actions,
  };
}

describe('projectActionCards', () => {
  it('derives action cards exclusively from projection.actions', () => {
    const cards = projectActionCards([
      projection('financial-reality', [
        {
          label: 'Contact Finanzamt',
          description: 'Schedule consultation.',
          priority: 'high',
          kind: 'contact',
        },
      ]),
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0]).toEqual({
      moduleId: 'financial-reality',
      actionId: 'financial-reality:contact:contact-finanzamt:0',
      label: 'Contact Finanzamt',
      description: 'Schedule consultation.',
      priority: 'high',
      kind: 'contact',
    });
  });

  it('orders by priority DESC, moduleId ASC, actionId ASC', () => {
    const cards = projectActionCards([
      projection('healthcare-navigation', [
        {
          label: 'Low priority action',
          description: 'Later.',
          priority: 'low',
          kind: 'custom',
        },
      ]),
      projection('financial-reality', [
        {
          label: 'High priority action',
          description: 'Now.',
          priority: 'high',
          kind: 'contact',
        },
        {
          label: 'Medium priority action',
          description: 'Soon.',
          priority: 'medium',
          kind: 'schedule',
        },
      ]),
    ]);

    expect(cards.map((card) => card.actionId)).toEqual([
      'financial-reality:contact:high-priority-action:0',
      'financial-reality:schedule:medium-priority-action:1',
      'healthcare-navigation:custom:low-priority-action:0',
    ]);
  });

  it('is deterministic for identical projections', () => {
    const projections = [
      projection('financial-reality', [
        {
          label: 'Apply benefit',
          description: 'Submit paperwork.',
          priority: 'medium',
          kind: 'apply',
        },
      ]),
    ];

    expect(JSON.stringify(projectActionCards(projections))).toBe(
      JSON.stringify(projectActionCards(projections))
    );
  });
});
