import { describe, expect, it } from 'vitest';
import { buildLifeEventInspectorCertaintyState, buildLifeEventCertaintyBundle } from '@/lib/certainty/adapters/life-event-certainty';
import { isCertaintyLayerEnabled } from '@/lib/certainty/certainty-feature-flag';
import {
  formatExpectedOutcome,
  formatProgressDelta,
  formatReason,
  getConfidencePresentation,
} from '@/lib/certainty/formatters';
import {
  isCertaintyExpectedOutcome,
  isCertaintyReason,
  validateCertaintyState,
} from '@/lib/certainty/validate-certainty-state';
import type { LifeEventPlanNode } from '@/lib/product-contract';

function node(partial: Partial<LifeEventPlanNode> & { id: string; title: string }): LifeEventPlanNode {
  return {
    actions: [],
    satisfied: false,
    blocked: false,
    ...partial,
  } as LifeEventPlanNode;
}

describe('certainty domain', () => {
  it('validates semantic certainty state shape', () => {
    expect(
      validateCertaintyState({
        location: 'Life Events',
        title: 'Register your address',
        nextAction: {
          label: 'Register your address',
          reason: { type: 'description', description: 'it unlocks housing support' },
          expectedOutcome: { type: 'openPath', target: 'Housing support' },
        },
        progress: { completed: 1, total: 4 },
        confidence: 'needs_attention',
      })
    ).toBe(true);

    expect(validateCertaintyState({ location: '', title: 'x' })).toBe(false);
    expect(
      validateCertaintyState({
        location: 'x',
        title: 'y',
        nextAction: { label: 'Go', reason: 'not semantic' as never },
      })
    ).toBe(false);
    expect(validateCertaintyState({ location: 'x', title: 'y', progress: { completed: 5, total: 2 } })).toBe(
      false
    );
  });

  it('validates reason and outcome guards', () => {
    expect(isCertaintyReason({ type: 'dependency', prerequisite: 'A', target: 'B' })).toBe(true);
    expect(isCertaintyReason({ type: 'description', description: 'x' })).toBe(true);
    expect(isCertaintyReason({ type: 'progress', target: 'Registration' })).toBe(true);
    expect(isCertaintyExpectedOutcome({ type: 'unlock', target: 'Housing' })).toBe(true);
  });

  it('builds life event certainty bundle with recommended node id', () => {
    const primary = node({
      id: 'registration',
      title: 'Registration',
      actions: [{ label: 'Register your address', href: '/profile' }],
    });

    const bundle = buildLifeEventCertaintyBundle({
      selectedNode: null,
      primaryAction: primary,
      timeline: [primary],
      dependencyNodeIds: [],
      titleForNode: (n) => n.title,
      descriptionForNode: () => 'housing support becomes available after registration',
    });

    expect(bundle.recommendedNodeId).toBe('registration');
    expect(validateCertaintyState(bundle.state)).toBe(true);
  });

  it('builds life event certainty with semantic reason and outcome', () => {
    const primary = node({
      id: 'registration',
      title: 'Registration',
      actions: [{ label: 'Register your address', href: '/profile' }],
    });
    primary.blocked = false;

    const state = buildLifeEventInspectorCertaintyState({
      selectedNode: null,
      primaryAction: primary,
      timeline: [primary, node({ id: 'housing', title: 'Housing', satisfied: false })],
      dependencyNodeIds: [],
      titleForNode: (n) => n.title,
      descriptionForNode: () => 'housing support becomes available after registration',
    });

    expect(state.location).toBe('Life Events');
    expect(state.nextAction?.label).toBe('Register your address');
    expect(state.nextAction?.reason).toEqual({
      type: 'description',
      description: 'housing support becomes available after registration',
    });
    expect(state.nextAction?.expectedOutcome).toEqual({ type: 'openPath', target: 'Housing' });
    expect(validateCertaintyState(state)).toBe(true);
  });

  it('builds blocked prerequisite certainty with dependency reason', () => {
    const blocked = node({ id: 'housing', title: 'Housing support', blocked: true });
    const registration = node({ id: 'registration', title: 'Registration' });

    const state = buildLifeEventInspectorCertaintyState({
      selectedNode: blocked,
      primaryAction: registration,
      timeline: [registration, blocked],
      dependencyNodeIds: ['registration'],
      titleForNode: (n) => n.title,
      descriptionForNode: () => 'description',
    });

    expect(state.confidence).toBe('blocked');
    expect(state.nextAction?.label).toBe('Registration');
    expect(state.nextAction?.reason).toEqual({
      type: 'dependency',
      prerequisite: 'Registration',
      target: 'Housing support',
    });
    expect(state.nextAction?.expectedOutcome).toEqual({
      type: 'unlock',
      target: 'Housing support',
    });
  });

  it('feature flag is disabled by default', () => {
    expect(isCertaintyLayerEnabled({})).toBe(false);
    expect(isCertaintyLayerEnabled({ NEXT_PUBLIC_CERTAINTY_LAYER_ENABLED: 'true' })).toBe(true);
  });
});

describe('certainty formatters', () => {
  it('maps semantic reason to language-neutral descriptors', () => {
    expect(
      formatReason({
        type: 'dependency',
        prerequisite: 'Registration',
        target: 'Housing support',
      })
    ).toEqual({
      key: 'certainty.reason.dependency',
      params: {
        target: 'Housing support',
        prerequisite: 'Registration',
      },
    });

    expect(
      formatReason({
        type: 'description',
        description: 'housing support becomes available after registration',
      })
    ).toEqual({
      key: 'certainty.reason.description',
      params: {
        description: 'housing support becomes available after registration',
      },
    });

    expect(formatReason({ type: 'progress', target: 'Registration' })).toEqual({
      key: 'certainty.reason.progress',
      params: { target: 'Registration' },
    });

    expect(formatReason({ type: 'description', description: '   ' })).toBeNull();
  });

  it('maps expected outcome and progress delta to descriptors', () => {
    expect(formatExpectedOutcome({ type: 'unlock', target: 'Housing support' })).toEqual({
      key: 'certainty.outcome.unlock',
      params: { target: 'Housing support' },
    });
    expect(formatExpectedOutcome({ type: 'openPath', target: 'Housing' })).toEqual({
      key: 'certainty.outcome.openPath',
      params: { target: 'Housing' },
    });

    expect(formatProgressDelta({ completed: 2, total: 5 })).toEqual({
      key: 'certainty.progress.partial',
      params: { completed: 2, total: 5 },
    });
    expect(formatProgressDelta({ completed: 0, total: 4 })).toEqual({
      key: 'certainty.progress.noneCompleted',
      params: { total: 4 },
    });
  });

  it('returns confidence presentation metadata with label keys', () => {
    const blocked = getConfidencePresentation('blocked');
    expect(blocked.labelKey).toBe('certainty.confidence.blocked');
    expect(blocked.icon).toBe('lock');
    expect(blocked.colorToken).toBe('blocked');
  });
});
