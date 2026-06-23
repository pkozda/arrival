import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { peekArrivalIntent, persistArrivalIntent, CELESTIAL_ARRIVAL_STORAGE_KEY } from '@/lib/celestial/arrival-storage';
import { spatialNavigationInterceptor } from '@/lib/atlas-runtime/spatial-navigation-interceptor';
import {
  installSpatialRouteInterceptor,
  normalizeNavigationPath,
  recordSpatialNavigation,
} from '@/lib/atlas-runtime/spatial-navigation';

describe('spatial-navigation', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('normalizes internal paths', () => {
    expect(normalizeNavigationPath('/profile?tab=housing')).toBe('/profile');
  });

  it('records spatial navigation intent', () => {
    recordSpatialNavigation('/', '/modules/life-event');
    expect(peekArrivalIntent('/modules/life-event')).toBe(true);
  });

  it('intercepts history.pushState when intent is missing', () => {
    const pushState = vi.fn();
    const replaceState = vi.fn();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();

    vi.stubGlobal('history', { pushState, replaceState });
    vi.stubGlobal('window', {
      addEventListener,
      removeEventListener,
      location: { pathname: '/modules/economic-reality' },
    });

    const onIntercept = vi.fn();

    const cleanup = installSpatialRouteInterceptor({
      getCurrentPath: () => '/profile',
      onNavigationStart: onIntercept,
    });

    history.pushState({}, '', '/modules/economic-reality');

    expect(onIntercept).toHaveBeenCalledWith('/profile', '/modules/economic-reality');
    expect(peekArrivalIntent('/modules/economic-reality')).toBe(true);
    cleanup();
    vi.unstubAllGlobals();
  });

  it('skips interceptor when intent already recorded', () => {
    const pushState = vi.fn();
    const replaceState = vi.fn();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();

    vi.stubGlobal('history', { pushState, replaceState });
    vi.stubGlobal('window', {
      addEventListener,
      removeEventListener,
      location: { pathname: '/modules/economic-reality' },
    });

    persistArrivalIntent({
      sourceNodeId: 'finance',
      destinationPath: '/modules/economic-reality',
      departedFromPath: '/profile',
      transitionType: 'fade-through-space',
      intensity: 'low',
    });

    const onIntercept = vi.fn();
    const cleanup = installSpatialRouteInterceptor({
      getCurrentPath: () => '/profile',
      onNavigationStart: onIntercept,
    });

    history.pushState({}, '', '/modules/economic-reality');

    expect(onIntercept).not.toHaveBeenCalled();
    cleanup();
    vi.unstubAllGlobals();
  });

  it('creates fallback drift intent for unknown navigation', () => {
    spatialNavigationInterceptor.ensureSpatialIntent('/profile', '/modules/life-event', {
      origin: 'unknown',
    });

    const raw = sessionStorage.getItem(CELESTIAL_ARRIVAL_STORAGE_KEY);
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw!) as {
      navigationMode?: string;
      navigationOrigin?: string;
      sourceNodeId?: string;
    };

    expect(parsed.navigationMode).toBe('fallback-spatial');
    expect(parsed.navigationOrigin).toBe('unknown');
    expect(parsed.sourceNodeId).toBe('center');
  });

  afterEach(() => {
    sessionStorage.removeItem(CELESTIAL_ARRIVAL_STORAGE_KEY);
    vi.unstubAllGlobals();
  });
});
