import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { DiscoveryProfile } from '../../types/profile.js';
import {
  ProfileStoreError,
  type ProfileStore,
} from '../../pipeline/profile-store.js';
import {
  deserializeDiscoveryProfile,
  DISCOVERY_PROFILE_RECORD_SCHEMA_VERSION,
  serializeDiscoveryProfile,
} from './profile-record.js';

export type SqliteProfilePersistenceConfig = {
  databasePath: string;
  ensureDirectory?: boolean;
};

export type SqliteProfilePersistence = ProfileStore & {
  close(): void;
  count(): number;
};

const MIGRATION_V1 = `
CREATE TABLE IF NOT EXISTS discovery_profiles (
  profile_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

/**
 * Durable ProfileStore (E7.1).
 */
export function createSqliteProfilePersistence(
  config: SqliteProfilePersistenceConfig
): SqliteProfilePersistence {
  const dbPath = config.databasePath;
  if (
    config.ensureDirectory !== false &&
    dbPath !== ':memory:' &&
    !dbPath.startsWith('file:')
  ) {
    mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(MIGRATION_V1);

  const selectById = db.prepare(
    `SELECT payload FROM discovery_profiles WHERE profile_id = ?`
  );
  const insertStmt = db.prepare(
    `INSERT INTO discovery_profiles
      (profile_id, payload, schema_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  const updateStmt = db.prepare(
    `UPDATE discovery_profiles
     SET payload = ?, schema_version = ?, updated_at = ?
     WHERE profile_id = ?`
  );
  const existsById = db.prepare(
    `SELECT profile_id FROM discovery_profiles WHERE profile_id = ?`
  );
  const countStmt = db.prepare(`SELECT COUNT(*) AS count FROM discovery_profiles`);
  const listAllStmt = db.prepare(`SELECT payload FROM discovery_profiles`);

  function mapReadError(err: unknown): never {
    if (err instanceof ProfileStoreError) throw err;
    throw new ProfileStoreError('Profile persistence read failed');
  }

  function mapWriteError(err: unknown): never {
    if (err instanceof ProfileStoreError) throw err;
    throw new ProfileStoreError('Profile persistence write failed');
  }

  return {
    async get(profileId: string): Promise<DiscoveryProfile | null> {
      try {
        const row = selectById.get(profileId) as { payload: string } | undefined;
        if (!row) return null;
        return deserializeDiscoveryProfile(row.payload);
      } catch (err) {
        mapReadError(err);
      }
    },

    async upsert(profile: DiscoveryProfile): Promise<void> {
      const payload = serializeDiscoveryProfile(profile);
      try {
          const write = db.transaction(() => {
          const exists = existsById.get(profile.id);
          if (exists) {
            updateStmt.run(
              payload,
              DISCOVERY_PROFILE_RECORD_SCHEMA_VERSION,
              profile.updatedAt,
              profile.id
            );
          } else {
            insertStmt.run(
              profile.id,
              payload,
              DISCOVERY_PROFILE_RECORD_SCHEMA_VERSION,
              profile.createdAt,
              profile.updatedAt
            );
          }
        });
        write();
      } catch (err) {
        mapWriteError(err);
      }
    },

    async listByUserId(userId: string): Promise<DiscoveryProfile[]> {
      try {
        const rows = listAllStmt.all() as { payload: string }[];
        return rows
          .map((row) => deserializeDiscoveryProfile(row.payload))
          .filter((p) => p.userId === userId);
      } catch (err) {
        mapReadError(err);
      }
    },

    close() {
      db.close();
    },

    count() {
      return (countStmt.get() as { count: number }).count;
    },
  };
}
