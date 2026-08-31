import type { NotificationRecord } from './types.js';

export interface NotificationStore {
  findById(id: string): Promise<NotificationRecord | null>;
  create(record: NotificationRecord): Promise<void>;
  update(record: NotificationRecord): Promise<void>;
}
