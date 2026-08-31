import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { NotificationStoreError } from '../../notifications/errors.js';
import type { NotificationStore } from '../../notifications/notification-store.js';
import type { NotificationRecord } from '../../notifications/types.js';

export const DISCOVERY_NOTIFICATION_SCHEMA_VERSION = 1;

export type SqliteNotificationPersistenceConfig = {
  databasePath: string;
  ensureDirectory?: boolean;
};

export type SqliteNotificationPersistence = NotificationStore & {
  close(): void;
  count(): number;
};

const MIGRATION_V1 = `
CREATE TABLE IF NOT EXISTS discovery_notifications (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  digest_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  failure_code TEXT,
  failure_message TEXT,
  schema_version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_discovery_notifications_profile
  ON discovery_notifications (profile_id);
CREATE INDEX IF NOT EXISTS idx_discovery_notifications_digest
  ON discovery_notifications (digest_id);
`;

function serializePayload(record: NotificationRecord): string {
  return JSON.stringify({
    recipient: record.recipient,
    payload: record.payload,
    failure: record.failure,
  });
}

function deserializePayload(raw: string): Pick<
  NotificationRecord,
  'recipient' | 'payload' | 'failure'
> {
  const parsed = JSON.parse(raw) as Pick<
    NotificationRecord,
    'recipient' | 'payload' | 'failure'
  >;
  return parsed;
}

type Row = {
  id: string;
  profile_id: string;
  digest_id: string;
  run_id: string;
  channel: string;
  recipient_user_id: string;
  recipient_address: string;
  payload: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  failure_code: string | null;
  failure_message: string | null;
};

function fromRow(row: Row): NotificationRecord {
  const extra = deserializePayload(row.payload);
  return {
    id: row.id,
    profileId: row.profile_id,
    digestId: row.digest_id,
    runId: row.run_id,
    channel: row.channel as NotificationRecord['channel'],
    recipient: extra.recipient,
    payload: extra.payload,
    status: row.status as NotificationRecord['status'],
    createdAt: row.created_at,
    sentAt: row.sent_at ?? undefined,
    failure:
      row.failure_code && row.failure_message
        ? {
            code: row.failure_code as NotificationRecord['failure'] extends infer F
              ? F extends { code: infer C }
                ? C
                : never
              : never,
            message: row.failure_message,
          }
        : extra.failure,
  };
}

export function createSqliteNotificationPersistence(
  config: SqliteNotificationPersistenceConfig
): SqliteNotificationPersistence {
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
  db.exec(MIGRATION_V1);

  return {
    async findById(id) {
      const row = db
        .prepare(`SELECT * FROM discovery_notifications WHERE id = ?`)
        .get(id) as Row | undefined;
      return row ? fromRow(row) : null;
    },

    async create(record) {
      try {
        db.prepare(
          `INSERT INTO discovery_notifications
            (id, profile_id, digest_id, run_id, channel,
             recipient_user_id, recipient_address, payload,
             status, created_at, sent_at, failure_code, failure_message, schema_version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          record.id,
          record.profileId,
          record.digestId,
          record.runId,
          record.channel,
          record.recipient.userId,
          record.recipient.address,
          serializePayload(record),
          record.status,
          record.createdAt,
          record.sentAt ?? null,
          record.failure?.code ?? null,
          record.failure?.message ?? null,
          DISCOVERY_NOTIFICATION_SCHEMA_VERSION
        );
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.includes('UNIQUE constraint failed')
        ) {
          throw new NotificationStoreError(`Notification already exists: ${record.id}`);
        }
        throw new NotificationStoreError('Notification create failed');
      }
    },

    async update(record) {
      const info = db
        .prepare(
          `UPDATE discovery_notifications
           SET payload = ?, status = ?, sent_at = ?, failure_code = ?, failure_message = ?
           WHERE id = ?`
        )
        .run(
          serializePayload(record),
          record.status,
          record.sentAt ?? null,
          record.failure?.code ?? null,
          record.failure?.message ?? null,
          record.id
        );
      if (info.changes !== 1) {
        throw new NotificationStoreError(`Notification not found: ${record.id}`);
      }
    },

    close() {
      db.close();
    },

    count() {
      const row = db
        .prepare(`SELECT COUNT(*) AS c FROM discovery_notifications`)
        .get() as { c: number };
      return row.c;
    },
  };
}
