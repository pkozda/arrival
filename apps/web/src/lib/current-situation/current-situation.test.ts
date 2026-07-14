import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CertaintySurfaceBundle } from '@/lib/certainty/types-bundle';
import type { CertaintyLevel } from '@/lib/certainty/types';
import {
  CurrentSituationRegistry,
  DEFAULT_SURFACE_PRIORITIES,
  getCurrentSituationRegistry,
  isCurrentSituationEnabled,
  resetCurrentSituationRegistry,
  resolveCurrentSituation,
  validateRegistration,
} from '@/lib/current-situation';

function bundle(
  confidence: CertaintyLevel,
  location = 'Surface',
  title = 'Focus'
): CertaintySurfaceBundle {
  return {
    state: { location, title, confidence },
    recommendedFocusId: 'focus-1',
  };
}

describe('current situation resolver', () => {
  afterEach(() => {
    resetCurrentSituationRegistry();
    vi.unstubAllEnvs();
  });

  it('resolves a single registered surface', () => {
    const registry = new CurrentSituationRegistry();
    registry.register({ surface: 'profile', bundle: bundle('needs_attention', 'Profile') });

    const result = registry.getCurrent();
    expect(result?.source).toBe('profile');
    expect(result?.reason).toBe('only_registered_surface');
    expect(result?.priority).toBe(DEFAULT_SURFACE_PRIORITIES.profile);
  });

  it('resolves three surfaces with blocked winning', () => {
    const registry = new CurrentSituationRegistry();
    registry.register({ surface: 'life-events', bundle: bundle('clear', 'Life Events') });
    registry.register({ surface: 'profile', bundle: bundle('needs_attention', 'Profile') });
    registry.register({ surface: 'economic', bundle: bundle('blocked', 'Economic Reality') });

    const result = registry.resolve();
    expect(result?.source).toBe('economic');
    expect(result?.reason).toBe('highest_priority_blocked');
  });

  it('prefers needs_attention over clear', () => {
    const map = new Map();
    const registrations = [
      {
        surface: 'life-events' as const,
        bundle: bundle('clear'),
        priority: 100,
        registeredAt: 1,
      },
      {
        surface: 'profile' as const,
        bundle: bundle('needs_attention'),
        priority: 60,
        registeredAt: 2,
      },
    ];
    registrations.forEach((entry) => map.set(entry.surface, entry));

    const result = resolveCurrentSituation(map);
    expect(result?.source).toBe('profile');
    expect(result?.reason).toBe('highest_confidence_needs_attention');
  });

  it('prefers life-events over profile when confidence is equal', () => {
    const registry = new CurrentSituationRegistry();
    registry.register({ surface: 'profile', bundle: bundle('needs_attention', 'Profile') });
    registry.register({ surface: 'life-events', bundle: bundle('needs_attention', 'Life Events') });

    expect(registry.getCurrent()?.source).toBe('life-events');
    expect(registry.getCurrent()?.reason).toBe('highest_surface_priority_tiebreak');
  });

  it('prefers economic over profile when confidence is equal', () => {
    const registry = new CurrentSituationRegistry();
    registry.register({ surface: 'profile', bundle: bundle('clear', 'Profile') });
    registry.register({ surface: 'economic', bundle: bundle('clear', 'Economic Reality') });

    expect(registry.getCurrent()?.source).toBe('economic');
    expect(registry.getCurrent()?.reason).toBe('highest_surface_priority_tiebreak');
  });

  it('promotes next surface when winner is removed', () => {
    const registry = new CurrentSituationRegistry();
    registry.register({ surface: 'life-events', bundle: bundle('blocked', 'Life Events') });
    registry.register({ surface: 'profile', bundle: bundle('needs_attention', 'Profile') });

    expect(registry.getCurrent()?.source).toBe('life-events');

    registry.remove('life-events');
    expect(registry.getCurrent()?.source).toBe('profile');
  });

  it('fires subscription on register and remove', () => {
    const registry = new CurrentSituationRegistry();
    const listener = vi.fn();
    registry.subscribe(listener);

    registry.register({ surface: 'profile', bundle: bundle('clear', 'Profile') });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.lastCall?.[0]?.source).toBe('profile');

    registry.remove('profile');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.lastCall?.[0]).toBeNull();
  });

  it('replaces duplicate registration for the same surface', () => {
    const registry = new CurrentSituationRegistry();
    registry.register({ surface: 'profile', bundle: bundle('clear', 'Profile', 'First') });
    registry.register({ surface: 'profile', bundle: bundle('needs_attention', 'Profile', 'Second') });

    expect(registry.size()).toBe(1);
    expect(registry.getCurrent()?.certainty.title).toBe('Second');
    expect(registry.getCurrent()?.certainty.confidence).toBe('needs_attention');
  });

  it('returns null for empty registry', () => {
    const registry = new CurrentSituationRegistry();
    expect(registry.resolve()).toBeNull();
    expect(registry.getCurrent()).toBeNull();
  });

  it('rejects invalid registrations without throwing', () => {
    const registry = new CurrentSituationRegistry();

    expect(
      registry.register({
        surface: 'profile',
        bundle: { state: { location: '', title: 'x' }, recommendedFocusId: null },
      }).ok
    ).toBe(false);

    expect(
      registry.register({
        surface: 'profile',
        bundle: {
          state: { location: 'Profile', title: 'Situation' },
          recommendedFocusId: null,
        },
      }).ok
    ).toBe(false);

    expect(registry.getCurrent()).toBeNull();
  });

  it('validateRegistration rejects invalid source and priority', () => {
    expect(
      validateRegistration({
        surface: 'invalid' as never,
        bundle: bundle('clear'),
      }).ok
    ).toBe(false);

    expect(
      validateRegistration({
        surface: 'profile',
        bundle: bundle('clear'),
        priority: -1,
      }).ok
    ).toBe(false);
  });

  it('resolve never throws on malformed internal state', () => {
    expect(() => resolveCurrentSituation(new Map())).not.toThrow();
  });

  it('exposes shared registry singleton', () => {
    const a = getCurrentSituationRegistry();
    const b = getCurrentSituationRegistry();
    expect(a).toBe(b);
  });

  it('feature flag is disabled by default', () => {
    expect(isCurrentSituationEnabled({})).toBe(false);
    expect(isCurrentSituationEnabled({ NEXT_PUBLIC_CURRENT_SITUATION_ENABLED: 'true' })).toBe(true);
  });
});
