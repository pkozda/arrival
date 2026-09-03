import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

/**
 * Durable per-discovery-user notification email (E13.3.2).
 * Keyed by Discovery userId (`accountId ?? sessionId`); not a profile field.
 * No session→account claim/migration — settings do not move when identity flips.
 */

export const DISCOVERY_USER_NOTIFICATION_EMAIL_SCHEMA_VERSION = 1;

export type UserNotificationEmailStore = {
  getUserNotificationEmail(userId: string): string | null;
  setUserNotificationEmail(userId: string, email: string): void;
  clearUserNotificationEmail(userId: string): void;
};

export type SqliteUserNotificationEmailStoreConfig = {
  databasePath: string;
  ensureDirectory?: boolean;
  /** Injectable clock for tests; defaults to Date.now ISO. */
  now?: () => string;
};

export type SqliteUserNotificationEmailStore = UserNotificationEmailStore & {
  close(): void;
};

const MIGRATION_V1 = `
CREATE TABLE IF NOT EXISTS discovery_user_notification_settings (
  user_id TEXT PRIMARY KEY,
  notification_email TEXT,
  updated_at TEXT NOT NULL,
  schema_version INTEGER NOT NULL
);
`;

function normalizeEmail(email: string): string {
  return email.trim();
}

/**
 * SQLite-backed store for Discovery user notification email.
 * Shares discovery.sqlite with other Discovery persistence adapters.
 */
export function createSqliteUserNotificationEmailStore(
  config: SqliteUserNotificationEmailStoreConfig
): SqliteUserNotificationEmailStore {
  const dbPath = config.databasePath;
  if (
    config.ensureDirectory !== false &&
    dbPath !== ':memory:' &&
    !dbPath.startsWith('file:')
  ) {
    mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }

  const now = config.now ?? (() => new Date().toISOString());
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(MIGRATION_V1);

  const selectStmt = db.prepare(
    `SELECT notification_email FROM discovery_user_notification_settings WHERE user_id = ?`
  );
  const upsertStmt = db.prepare(
    `INSERT INTO discovery_user_notification_settings
      (user_id, notification_email, updated_at, schema_version)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       notification_email = excluded.notification_email,
       updated_at = excluded.updated_at,
       schema_version = excluded.schema_version`
  );
  const deleteStmt = db.prepare(
    `DELETE FROM discovery_user_notification_settings WHERE user_id = ?`
  );

  return {
    getUserNotificationEmail(userId: string): string | null {
      const row = selectStmt.get(userId) as
        | { notification_email: string | null }
        | undefined;
      if (!row || row.notification_email == null) {
        return null;
      }
      const trimmed = row.notification_email.trim();
      return trimmed.length > 0 ? trimmed : null;
    },

    setUserNotificationEmail(userId: string, email: string): void {
      const normalized = normalizeEmail(email);
      if (normalized.length === 0) {
        deleteStmt.run(userId);
        return;
      }
      upsertStmt.run(
        userId,
        normalized,
        now(),
        DISCOVERY_USER_NOTIFICATION_EMAIL_SCHEMA_VERSION
      );
    },

    clearUserNotificationEmail(userId: string): void {
      deleteStmt.run(userId);
    },

    close() {
      db.close();
    },
  };
}
