import { describe, expect, it } from 'vitest';
import {
  createStrategyRegistry,
  StrategyRegistryError,
} from './registry/strategy-registry.js';
import { jobDiscoveryStrategyV1 } from './strategies/job-discovery-v1.js';
import { giveawayDiscoveryStrategyV1 } from './strategies/giveaway-discovery-v1.js';
import { createDefaultDiscoveryRegistry } from './index.js';

describe('StrategyRegistry', () => {
  it('resolves exact version', () => {
    const registry = createStrategyRegistry([jobDiscoveryStrategyV1]);
    const found = registry.get('job-discovery', '1');
    expect(found.version).toBe('1');
    expect(found.id).toBe('job-discovery');
  });

  it('does not silently resolve missing version to latest', () => {
    const registry = createStrategyRegistry([jobDiscoveryStrategyV1]);
    expect(() => registry.get('job-discovery', '99')).toThrow(StrategyRegistryError);
    expect(() => registry.get('job-discovery', '99')).toThrow(/no silent latest fallback/);
  });

  it('lists latest strategies', () => {
    const registry = createDefaultDiscoveryRegistry();
    const latest = registry.listLatest();
    expect(latest.map((s) => `${s.id}@${s.version}`).sort()).toEqual([
      'giveaway-discovery@1',
      'job-discovery@1',
    ]);
  });

  it('rejects duplicate id@version registration', () => {
    const registry = createStrategyRegistry([jobDiscoveryStrategyV1]);
    expect(() => registry.register(jobDiscoveryStrategyV1)).toThrow(/Duplicate/);
  });

  it('registers giveaway and job stubs', () => {
    const registry = createStrategyRegistry([
      jobDiscoveryStrategyV1,
      giveawayDiscoveryStrategyV1,
    ]);
    expect(registry.has('giveaway-discovery', '1')).toBe(true);
    expect(registry.getDescriptor('giveaway-discovery', '1').verificationPolicy.requireOfficialSource).toBe(
      false
    );
    expect(registry.getDescriptor('job-discovery', '1').verificationPolicy.requireOfficialSource).toBe(
      true
    );
  });
});
