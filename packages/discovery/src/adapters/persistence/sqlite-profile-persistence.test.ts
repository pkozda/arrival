import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  deserializeDiscoveryProfile,
  DISCOVERY_PROFILE_RECORD_SCHEMA_VERSION,
  emptyCriteria,
  ProfileStoreError,
  serializeDiscoveryProfile,
  type DiscoveryProfile,
} from '../../index.js';
import { createSqliteProfilePersistence } from './sqlite-profile-persistence.js';

function sampleProfile(overrides: Partial<DiscoveryProfile> = {}): DiscoveryProfile {
  return {
    id: 'profile-job',
    userId: 'user-1',
    name: 'Jobs',
    strategyId: 'job-discovery',
    strategyVersion: '1',
    criteria: {
      ...emptyCriteria(),
      required: [{ key: 'country', value: 'DE' }],
      preferred: [{ key: 'role', value: 'Frontend Engineer' }],
      excluded: [{ key: 'role', value: 'Team Lead' }],
    },
    schedule: { cadence: 'daily', hourUtc: 8 },
    notification: { emailEnabled: true, skipEmptyDigest: false },
    enabled: true,
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
    ...overrides,
  };
}

function tempDbPath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'discovery-e71-profile-'));
  return path.join(dir, 'profiles.sqlite');
}

function cleanupDb(dbPath: string) {
  try {
    rmSync(path.dirname(dbPath), { recursive: true, force: true });
  } catch {
    // best effort
  }
}

describe('E7.1 profile record serialization', () => {
  it('round-trips DiscoveryProfile deterministically', () => {
    const profile = sampleProfile();
    const payload = serializeDiscoveryProfile(profile);
    const parsed = deserializeDiscoveryProfile(payload);
    expect(parsed).toEqual(profile);
    expect(JSON.parse(payload).schemaVersion).toBe(
      DISCOVERY_PROFILE_RECORD_SCHEMA_VERSION
    );
  });

  it('rejects unsupported schema version and malformed JSON', () => {
    const bad = JSON.stringify({
      schemaVersion: 999,
      profile: sampleProfile(),
    });
    expect(() => deserializeDiscoveryProfile(bad)).toThrow(ProfileStoreError);
    expect(() => deserializeDiscoveryProfile('not-json')).toThrow(ProfileStoreError);
    expect(() =>
      deserializeDiscoveryProfile(JSON.stringify({ schemaVersion: 1, profile: {} }))
    ).toThrow(ProfileStoreError);
  });
});

describe('E7.1 SQLite ProfileStore', () => {
  it('upsert + get returns persisted profile', async () => {
    const dbPath = tempDbPath();
    const store = createSqliteProfilePersistence({ databasePath: dbPath });
    try {
      const profile = sampleProfile();
      await store.upsert(profile);
      const found = await store.get(profile.id);
      expect(found).toEqual(profile);
      expect(store.count()).toBe(1);
    } finally {
      store.close();
      cleanupDb(dbPath);
    }
  });

  it('updates existing profile on second upsert', async () => {
    const dbPath = tempDbPath();
    const store = createSqliteProfilePersistence({ databasePath: dbPath });
    try {
      const original = sampleProfile();
      await store.upsert(original);
      const updated = sampleProfile({
        name: 'Updated Jobs',
        enabled: false,
        updatedAt: '2026-09-01T12:00:00.000Z',
        notification: { emailEnabled: false, skipEmptyDigest: true },
      });
      await store.upsert(updated);
      const found = await store.get(original.id);
      expect(found).toEqual(updated);
      expect(store.count()).toBe(1);
    } finally {
      store.close();
      cleanupDb(dbPath);
    }
  });

  it('preserves criteria, strategy, notification, and enabled fields', async () => {
    const dbPath = tempDbPath();
    const store = createSqliteProfilePersistence({ databasePath: dbPath });
    try {
      const profile = sampleProfile({
        strategyId: 'job-discovery',
        strategyVersion: '2',
        enabled: false,
        criteria: {
          ...emptyCriteria(),
          required: [{ key: 'country', value: 'NL' }],
          preferred: [{ key: 'role', value: 'Backend Engineer' }],
        },
        notification: { emailEnabled: false, skipEmptyDigest: true },
      });
      await store.upsert(profile);
      const found = await store.get(profile.id);
      expect(found?.strategyId).toBe('job-discovery');
      expect(found?.strategyVersion).toBe('2');
      expect(found?.criteria).toEqual(profile.criteria);
      expect(found?.notification).toEqual(profile.notification);
      expect(found?.enabled).toBe(false);
    } finally {
      store.close();
      cleanupDb(dbPath);
    }
  });

  it('preserves timestamps across round-trip', async () => {
    const dbPath = tempDbPath();
    const store = createSqliteProfilePersistence({ databasePath: dbPath });
    try {
      const profile = sampleProfile({
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z',
      });
      await store.upsert(profile);
      const found = await store.get(profile.id);
      expect(found?.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(found?.updatedAt).toBe('2026-02-01T00:00:00.000Z');
    } finally {
      store.close();
      cleanupDb(dbPath);
    }
  });

  it('stores multiple profiles independently', async () => {
    const dbPath = tempDbPath();
    const store = createSqliteProfilePersistence({ databasePath: dbPath });
    try {
      const a = sampleProfile({ id: 'profile-a', name: 'A' });
      const b = sampleProfile({ id: 'profile-b', name: 'B' });
      await store.upsert(a);
      await store.upsert(b);
      expect(store.count()).toBe(2);
      expect(await store.get('profile-a')).toEqual(a);
      expect(await store.get('profile-b')).toEqual(b);
    } finally {
      store.close();
      cleanupDb(dbPath);
    }
  });

  it('missing profile returns null', async () => {
    const dbPath = tempDbPath();
    const store = createSqliteProfilePersistence({ databasePath: dbPath });
    try {
      expect(await store.get('missing')).toBeNull();
    } finally {
      store.close();
      cleanupDb(dbPath);
    }
  });

  it('survives close and reopen of the same database file', async () => {
    const dbPath = tempDbPath();
    const profile = sampleProfile();
    const writer = createSqliteProfilePersistence({ databasePath: dbPath });
    await writer.upsert(profile);
    writer.close();

    const reader = createSqliteProfilePersistence({ databasePath: dbPath });
    try {
      expect(await reader.get(profile.id)).toEqual(profile);
      expect(reader.count()).toBe(1);
    } finally {
      reader.close();
      cleanupDb(dbPath);
    }
  });

  it('read after close throws ProfileStoreError', async () => {
    const dbPath = tempDbPath();
    const store = createSqliteProfilePersistence({ databasePath: dbPath });
    await store.upsert(sampleProfile());
    store.close();
    await expect(store.get('profile-job')).rejects.toBeInstanceOf(ProfileStoreError);
    cleanupDb(dbPath);
  });
});
