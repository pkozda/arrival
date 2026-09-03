import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as discovery from '@arrival-atlas/discovery';
import {
  getDiscoveryExecutionService,
  resetDiscoveryExecutionForTests,
  resolveDiscoveryExecutionRegistry,
} from './discovery-execution-runtime.js';
import {
  getDiscoveryUserService,
  resetDiscoveryRuntimeForTests,
  resolveDiscoveryUserId,
} from './discovery-user-runtime.js';

describe('E12.1 Atlas execution registry alignment', () => {
  const dirs: string[] = [];
  const originalSmokeEnv = process.env.DISCOVERY_USE_SMOKE_TRANSPORT;

  beforeEach(() => {
    delete process.env.DISCOVERY_USE_SMOKE_TRANSPORT;
  });

  afterEach(() => {
    for (const dir of dirs) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    if (originalSmokeEnv === undefined) {
      delete process.env.DISCOVERY_USE_SMOKE_TRANSPORT;
    } else {
      process.env.DISCOVERY_USE_SMOKE_TRANSPORT = originalSmokeEnv;
    }
    delete process.env.ARRIVAL_ATLAS_STATE_DIR;
    resetDiscoveryRuntimeForTests();
    resetDiscoveryExecutionForTests();
    vi.restoreAllMocks();
  });

  function isolateDiscoveryState() {
    const dir = mkdtempSync(path.join(tmpdir(), 'discovery-e121-'));
    dirs.push(dir);
    process.env.ARRIVAL_ATLAS_STATE_DIR = dir;
    resetDiscoveryRuntimeForTests();
    resetDiscoveryExecutionForTests();
    return dir;
  }

  it('createDefaultDiscoveryRegistry resolves job and giveaway strategies', () => {
    const registry = discovery.createDefaultDiscoveryRegistry();
    expect(registry.has('job-discovery', '1')).toBe(true);
    expect(registry.has('giveaway-discovery', '1')).toBe(true);
    expect(registry.get('job-discovery', '1').id).toBe('job-discovery');
    expect(registry.get('giveaway-discovery', '1').id).toBe('giveaway-discovery');
  });

  it('smokeRegistry remains job-only for deterministic package tests', () => {
    const registry = discovery.smokeRegistry();
    expect(registry.has('job-discovery', '1')).toBe(true);
    expect(registry.has('giveaway-discovery', '1')).toBe(false);
  });

  it('resolveDiscoveryExecutionRegistry uses production registry outside smoke mode', () => {
    delete process.env.DISCOVERY_USE_SMOKE_TRANSPORT;
    process.env.ARRIVAL_ATLAS_DEV_TOOLS = 'false';
    const registry = resolveDiscoveryExecutionRegistry();
    expect(registry.has('job-discovery', '1')).toBe(true);
    expect(registry.has('giveaway-discovery', '1')).toBe(true);
    delete process.env.ARRIVAL_ATLAS_DEV_TOOLS;
  });

  it('resolveDiscoveryExecutionRegistry uses smoke registry in deterministic test mode', () => {
    process.env.DISCOVERY_USE_SMOKE_TRANSPORT = 'true';
    const registry = resolveDiscoveryExecutionRegistry();
    expect(registry.has('job-discovery', '1')).toBe(true);
    expect(registry.has('giveaway-discovery', '1')).toBe(false);
  });

  it('getDiscoveryExecutionService wires production registry outside smoke mode', () => {
    isolateDiscoveryState();
    delete process.env.DISCOVERY_USE_SMOKE_TRANSPORT;
    process.env.ARRIVAL_ATLAS_DEV_TOOLS = 'false';
    const createService = vi.spyOn(discovery, 'createDiscoveryService');

    getDiscoveryExecutionService();

    expect(createService).toHaveBeenCalledOnce();
    const config = createService.mock.calls[0]![0];
    expect(config.registry.has('job-discovery', '1')).toBe(true);
    expect(config.registry.has('giveaway-discovery', '1')).toBe(true);
    expect(config.production.transport).toBeUndefined();
    delete process.env.ARRIVAL_ATLAS_DEV_TOOLS;
  });

  it('getDiscoveryExecutionService keeps smoke registry when DISCOVERY_USE_SMOKE_TRANSPORT is set', () => {
    isolateDiscoveryState();
    process.env.DISCOVERY_USE_SMOKE_TRANSPORT = 'true';
    const createService = vi.spyOn(discovery, 'createDiscoveryService');

    getDiscoveryExecutionService();

    expect(createService).toHaveBeenCalledOnce();
    const config = createService.mock.calls[0]![0];
    expect(config.registry.has('job-discovery', '1')).toBe(true);
    expect(config.registry.has('giveaway-discovery', '1')).toBe(false);
    expect(config.production.transport).toBeDefined();
  });

  it('Atlas execution resolves giveaway strategy with production registry', async () => {
    isolateDiscoveryState();
    delete process.env.DISCOVERY_USE_SMOKE_TRANSPORT;
    process.env.ARRIVAL_ATLAS_DEV_TOOLS = 'false';

    const originalCreate = discovery.createDiscoveryService;
    vi.spyOn(discovery, 'createDiscoveryService').mockImplementation((config) => {
      expect(config.registry.has('giveaway-discovery', '1')).toBe(true);
      return originalCreate({
        ...config,
        production: {
          ...config.production,
          transport: discovery.happyPathTransport(),
        },
      });
    });

    const sessionId = 'sess-giveaway-registry';
    const userId = resolveDiscoveryUserId({ sessionId, accountId: null });

    await getDiscoveryUserService().createProfile(userId, {
      id: 'profile-giveaway-registry',
      name: 'Giveaway Registry',
      strategyId: 'giveaway-discovery',
      strategyVersion: '1',
      criteria: {
        required: [
          { key: 'country', value: 'DE' },
          { key: 'freeParticipation', value: true },
        ],
        preferred: [],
        excluded: [],
        flexible: [],
      },
      schedule: { cadence: 'manual' },
      notification: { emailEnabled: false, skipEmptyDigest: true },
      enabled: true,
    });

    resetDiscoveryExecutionForTests();

    const outcome = await getDiscoveryUserService().runProfileNow(
      userId,
      'profile-giveaway-registry'
    );

    expect(outcome.errorMessage ?? '').not.toMatch(/Strategy not found/i);
    delete process.env.ARRIVAL_ATLAS_DEV_TOOLS;
  });
});
