import type { DiscoveryProfile } from '../../types/profile.js';
import { ProfileStoreError } from '../../pipeline/profile-store.js';

export const DISCOVERY_PROFILE_RECORD_SCHEMA_VERSION = 1 as const;

export type DiscoveryProfileRecordV1 = {
  schemaVersion: typeof DISCOVERY_PROFILE_RECORD_SCHEMA_VERSION;
  profile: DiscoveryProfile;
};

export function serializeDiscoveryProfile(profile: DiscoveryProfile): string {
  const record: DiscoveryProfileRecordV1 = {
    schemaVersion: DISCOVERY_PROFILE_RECORD_SCHEMA_VERSION,
    profile: structuredClone(profile),
  };
  return JSON.stringify(record);
}

export function deserializeDiscoveryProfile(payload: string): DiscoveryProfile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload) as unknown;
  } catch {
    throw new ProfileStoreError('Invalid persisted profile JSON');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ProfileStoreError('Persisted profile is not an object');
  }

  const schemaVersion = (parsed as { schemaVersion?: unknown }).schemaVersion;
  if (schemaVersion !== DISCOVERY_PROFILE_RECORD_SCHEMA_VERSION) {
    throw new ProfileStoreError(
      `Unsupported discovery profile schema version: ${String(schemaVersion)}`
    );
  }

  const profile = (parsed as { profile?: unknown }).profile;
  return validateDiscoveryProfileShape(profile);
}

function validateDiscoveryProfileShape(value: unknown): DiscoveryProfile {
  if (!value || typeof value !== 'object') {
    throw new ProfileStoreError('Persisted profile missing body');
  }

  const p = value as Record<string, unknown>;
  requireString(p, 'id');
  requireString(p, 'userId');
  requireString(p, 'name');
  requireString(p, 'strategyId');
  requireString(p, 'strategyVersion');
  requireString(p, 'createdAt');
  requireString(p, 'updatedAt');
  if (typeof p.enabled !== 'boolean') {
    throw new ProfileStoreError('Persisted profile enabled invalid');
  }
  if (!p.criteria || typeof p.criteria !== 'object') {
    throw new ProfileStoreError('Persisted profile criteria invalid');
  }
  if (!p.schedule || typeof p.schedule !== 'object') {
    throw new ProfileStoreError('Persisted profile schedule invalid');
  }
  if (!p.notification || typeof p.notification !== 'object') {
    throw new ProfileStoreError('Persisted profile notification invalid');
  }

  return p as unknown as DiscoveryProfile;
}

function requireString(obj: Record<string, unknown>, key: string): void {
  if (typeof obj[key] !== 'string' || !(obj[key] as string).trim()) {
    throw new ProfileStoreError(`Persisted profile missing ${key}`);
  }
}
