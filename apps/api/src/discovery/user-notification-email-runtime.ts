import path from 'node:path';
import {
  createSqliteUserNotificationEmailStore,
  type SqliteUserNotificationEmailStore,
  type UserNotificationEmailStore,
} from '@arrival-atlas/discovery';

/**
 * Composition-root singleton for Discovery user notification email (E13.3.2).
 * Shares discovery.sqlite with other Discovery persistence.
 * Keyed by current Discovery userId only — no session→account claim migration.
 */

function resolveStateDir(): string {
  return process.env.ARRIVAL_ATLAS_STATE_DIR ?? path.join(process.cwd(), '.arrival-atlas-state');
}

function discoveryDbPath(): string {
  return path.join(resolveStateDir(), 'discovery.sqlite');
}

let store: SqliteUserNotificationEmailStore | null = null;

export function getDiscoveryUserNotificationEmailStore(): UserNotificationEmailStore {
  if (!store) {
    store = createSqliteUserNotificationEmailStore({
      databasePath: discoveryDbPath(),
    });
  }
  return store;
}

/** Test-only: close and drop singleton so ARRIVAL_ATLAS_STATE_DIR can vary. */
export function resetDiscoveryUserNotificationEmailStoreForTests(): void {
  store?.close();
  store = null;
}
