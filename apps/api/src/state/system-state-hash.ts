import { createHash } from 'node:crypto';
import type { SystemState } from './system-state-types.js';

export type SystemStateContent = Omit<SystemState, 'version'>;

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}

function normalizeForHash(content: SystemStateContent): SystemStateContent {
  const executionsByModuleId = Object.fromEntries(
    Object.entries(content.executionsByModuleId).map(([moduleId, history]) => [
      moduleId,
      history.map((entry) => ({ ...entry, snapshotVersion: 0 })),
    ])
  );

  return {
    ...content,
    executionsByModuleId,
  };
}

export function hashSystemStateContent(content: SystemStateContent): string {
  return createHash('sha256').update(stableSerialize(normalizeForHash(content))).digest('hex');
}

export function snapshotVersionFromHash(stateHash: string): number {
  return Number.parseInt(stateHash.slice(0, 8), 16) >>> 0;
}

export function finalizeSystemState(
  content: SystemStateContent,
  mutationId: string
): SystemState {
  const stateHash = hashSystemStateContent(content);
  return {
    ...content,
    version: {
      snapshotVersion: snapshotVersionFromHash(stateHash),
      stateHash,
      lastMutationId: mutationId,
    },
  };
}
