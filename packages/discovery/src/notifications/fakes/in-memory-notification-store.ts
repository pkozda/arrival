import { NotificationStoreError } from '../errors.js';
import type { NotificationStore } from '../notification-store.js';
import type { NotificationRecord } from '../types.js';

export function createInMemoryNotificationStore(
  seed: NotificationRecord[] = []
): NotificationStore & {
  snapshot(): NotificationRecord[];
} {
  const records = new Map<string, NotificationRecord>(
    seed.map((r) => [r.id, structuredClone(r)])
  );

  return {
    async findById(id) {
      const found = records.get(id);
      return found ? structuredClone(found) : null;
    },

    async create(record) {
      if (records.has(record.id)) {
        throw new NotificationStoreError(`Notification already exists: ${record.id}`);
      }
      records.set(record.id, structuredClone(record));
    },

    async update(record) {
      if (!records.has(record.id)) {
        throw new NotificationStoreError(`Notification not found: ${record.id}`);
      }
      records.set(record.id, structuredClone(record));
    },

    snapshot() {
      return [...records.values()].map((r) => structuredClone(r));
    },
  };
}
