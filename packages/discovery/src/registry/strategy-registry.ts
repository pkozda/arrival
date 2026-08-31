import type {
  DiscoveryStrategyDescriptor,
  DiscoveryStrategyModule,
} from '../types/strategy.js';
import { toStrategyDescriptor } from '../types/strategy.js';

export class StrategyRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StrategyRegistryError';
  }
}

export interface StrategyRegistry {
  register(strategy: DiscoveryStrategyModule): void;
  get(id: string, version: string): DiscoveryStrategyModule;
  getDescriptor(id: string, version: string): DiscoveryStrategyDescriptor;
  listLatest(): DiscoveryStrategyDescriptor[];
  has(id: string, version: string): boolean;
}

function keyOf(id: string, version: string): string {
  return `${id}@${version}`;
}

/**
 * In-memory registry. Exact (id, version) lookup — never silently substitutes latest.
 */
export function createStrategyRegistry(
  initial: DiscoveryStrategyModule[] = []
): StrategyRegistry {
  const byKey = new Map<string, DiscoveryStrategyModule>();

  const registry: StrategyRegistry = {
    register(strategy) {
      const key = keyOf(strategy.id, strategy.version);
      if (byKey.has(key)) {
        throw new StrategyRegistryError(
          `Duplicate strategy registration: ${key}`
        );
      }
      byKey.set(key, strategy);
    },

    get(id, version) {
      const found = byKey.get(keyOf(id, version));
      if (!found) {
        throw new StrategyRegistryError(
          `Strategy not found: ${id}@${version} (no silent latest fallback)`
        );
      }
      return found;
    },

    getDescriptor(id, version) {
      return toStrategyDescriptor(registry.get(id, version));
    },

    listLatest() {
      const latest = new Map<string, DiscoveryStrategyModule>();
      for (const strategy of byKey.values()) {
        const current = latest.get(strategy.id);
        if (!current || compareVersion(strategy.version, current.version) > 0) {
          latest.set(strategy.id, strategy);
        }
      }
      return [...latest.values()]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(toStrategyDescriptor);
    },

    has(id, version) {
      return byKey.has(keyOf(id, version));
    },
  };

  for (const strategy of initial) {
    registry.register(strategy);
  }

  return registry;
}

/** Numeric / dotted versions: "1" < "2", "1.0" < "1.1". Non-numeric → localeCompare. */
function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map((p) => Number.parseInt(p, 10));
  const pb = b.split('.').map((p) => Number.parseInt(p, 10));
  if (pa.every((n) => Number.isFinite(n)) && pb.every((n) => Number.isFinite(n))) {
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i += 1) {
      const da = pa[i] ?? 0;
      const db = pb[i] ?? 0;
      if (da !== db) return da - db;
    }
    return 0;
  }
  return a.localeCompare(b);
}
