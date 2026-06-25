import { describe, expect, it, beforeEach } from 'vitest';
import { SpatialMemoryStore } from '@/lib/atlas-runtime/spatial-memory-store';
import { getSpatialTransitionContext } from '@/lib/atlas-runtime/spatial-transition-context';
import { buildSpatialTransition } from '@/lib/atlas-runtime/spatial-transition-engine';

describe('spatial-memory-store', () => {
  let memory: SpatialMemoryStore;

  beforeEach(() => {
    memory = new SpatialMemoryStore();
  });

  it('tracks route stack on forward navigation', () => {
    memory.recordNavigation('/', '/modules/life-event', 'registration', 'forward');
    expect(memory.getSnapshot().routeStack).toEqual(['/', '/modules/life-event']);
    expect(memory.getSnapshot().navigationDepth).toBe(2);
  });

  it('detects return trip A → B → A', () => {
    memory.recordNavigation('/', '/modules/life-event', 'registration', 'forward');
    memory.recordNavigation('/modules/life-event', '/profile', 'housing', 'forward');

    const context = getSpatialTransitionContext(
      '/profile',
      '/modules/life-event',
      memory,
      'explicit'
    );

    expect(context.isReturnTrip).toBe(true);
    expect(context.direction).toBe('backward');
  });

  it('marks memory match on repeated transition pattern', () => {
    memory.recordNavigation('/', '/profile', 'housing', 'forward');
    memory.recordNavigation('/profile', '/', 'center', 'backward');
    memory.recordNavigation('/', '/profile', 'housing', 'forward');

    const context = getSpatialTransitionContext('/', '/profile', memory, 'explicit');
    expect(context.memoryMatch).toBe(true);
  });
});

describe('spatial-transition-context', () => {
  let memory: SpatialMemoryStore;

  beforeEach(() => {
    memory = new SpatialMemoryStore();
  });

  it('maps node-to-module as forward expand', () => {
    const context = getSpatialTransitionContext('/', '/modules/life-event', memory, 'explicit');
    expect(context.relation).toBe('node-to-module');
    expect(context.direction).toBe('forward');

    const transition = buildSpatialTransition(
      {
        sourceNodeId: 'registration',
        destinationPath: '/modules/life-event',
        departedFromPath: '/',
        transitionType: 'warp',
        intensity: 'high',
        entryAnimationState: 'pending',
        capturedAt: 0,
        spatialTransitionContext: context,
      },
      context
    );

    expect(transition.motionPrimitive).toBe('expand-from-node');
  });

  it('maps same-cluster module navigation to drift', () => {
    memory.recordNavigation('/', '/modules/life-event', 'registration', 'forward');

    const context = getSpatialTransitionContext(
      '/modules/life-event',
      '/modules/life-event/plan',
      memory,
      'explicit'
    );

    expect(context.relation).toBe('same-cluster');

    const transition = buildSpatialTransition(
      {
        sourceNodeId: 'registration',
        destinationPath: '/modules/life-event/plan',
        departedFromPath: '/modules/life-event',
        transitionType: 'fade-through-space',
        intensity: 'low',
        entryAnimationState: 'pending',
        capturedAt: 0,
        spatialTransitionContext: context,
      },
      context
    );

    expect(transition.motionPrimitive).toBe('drift');
  });

  it('applies familiar motion modifiers on memory match', () => {
    memory.recordNavigation('/', '/profile', 'housing', 'forward');
    memory.recordNavigation('/profile', '/', 'center', 'backward');

    const context = getSpatialTransitionContext('/', '/profile', memory, 'explicit');
    const transition = buildSpatialTransition(
      {
        sourceNodeId: 'housing',
        destinationPath: '/profile',
        departedFromPath: '/',
        transitionType: 'fade-through-space',
        intensity: 'medium',
        entryAnimationState: 'pending',
        capturedAt: 0,
        spatialTransitionContext: context,
      },
      context
    );

    expect(context.memoryMatch).toBe(true);
    expect(transition.durationScale).toBeLessThan(1);
    expect(transition.motionScale).toBeLessThan(1);
  });

  it('uses return path collapse for A → B → A', () => {
    memory.recordNavigation('/', '/modules/life-event', 'registration', 'forward');

    const context = getSpatialTransitionContext(
      '/modules/life-event',
      '/',
      memory,
      'explicit'
    );

    const transition = buildSpatialTransition(
      {
        sourceNodeId: 'center',
        destinationPath: '/',
        departedFromPath: '/modules/life-event',
        transitionType: 'zoom-collapse',
        intensity: 'low',
        entryAnimationState: 'pending',
        capturedAt: 0,
        spatialTransitionContext: context,
      },
      context
    );

    expect(context.isReturnTrip).toBe(true);
    expect(transition.motionPrimitive).toBe('collapse-to-node');
    expect(transition.isReturnPath).toBe(true);
  });
});
