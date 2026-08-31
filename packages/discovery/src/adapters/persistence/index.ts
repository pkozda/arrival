export {
  DISCOVERY_RESULT_RECORD_SCHEMA_VERSION,
  serializeDiscoveryResult,
  deserializeDiscoveryResult,
  type DiscoveryResultRecordV1,
} from './result-record.js';

export type { SqliteResultPersistenceConfig, SqliteResultPersistence } from './sqlite-result-persistence.js';
export { createSqliteResultPersistence } from './sqlite-result-persistence.js';

export type {
  SqliteSchedulerPersistenceConfig,
  SqliteSchedulerPersistence,
} from './sqlite-scheduler-persistence.js';
export {
  DISCOVERY_SCHEDULER_SCHEMA_VERSION,
  createSqliteSchedulerPersistence,
} from './sqlite-scheduler-persistence.js';

export type {
  SqliteNotificationPersistenceConfig,
  SqliteNotificationPersistence,
} from './sqlite-notification-persistence.js';
export {
  DISCOVERY_NOTIFICATION_SCHEMA_VERSION,
  createSqliteNotificationPersistence,
} from './sqlite-notification-persistence.js';
