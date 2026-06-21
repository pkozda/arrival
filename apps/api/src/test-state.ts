import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileAccountStore, resetAccountStore } from './account/account.store.js';
import { FileEntitlementStore, resetEntitlementStore } from './entitlements/entitlement.store.js';
import { FileSessionRegistryStore, resetSessionRegistryStore } from './sessions/registry/session-registry.store.js';
import {
  FilePersistedSystemStateStore,
  resetPersistedSystemStateStore,
} from './state/persisted-system-state-store.js';
import { clearAllPersistedDevState } from './dev/reset-local-state.js';

let activeTestDir: string | null = null;

export function setupTestStateStore(): FilePersistedSystemStateStore {
  if (activeTestDir) {
    rmSync(activeTestDir, { recursive: true, force: true });
  }

  activeTestDir = mkdtempSync(join(tmpdir(), 'arrival-atlas-state-test-'));
  const store = new FilePersistedSystemStateStore(activeTestDir);
  resetPersistedSystemStateStore(store);
  process.env.ARRIVAL_ATLAS_STATE_DIR = activeTestDir;

  const accountsDir = join(activeTestDir, 'accounts');
  const accountStore = new FileAccountStore(accountsDir);
  resetAccountStore(accountStore);
  process.env.ARRIVAL_ATLAS_ACCOUNTS_DIR = accountsDir;

  const entitlementsDir = join(activeTestDir, 'entitlements');
  const entitlementStore = new FileEntitlementStore(entitlementsDir);
  resetEntitlementStore(entitlementStore);
  process.env.ARRIVAL_ATLAS_ENTITLEMENTS_DIR = entitlementsDir;

  const sessionsDir = join(activeTestDir, 'sessions-registry');
  const sessionRegistryStore = new FileSessionRegistryStore(sessionsDir);
  resetSessionRegistryStore(sessionRegistryStore);
  process.env.ARRIVAL_ATLAS_SESSIONS_DIR = sessionsDir;

  process.env.ARRIVAL_ATLAS_AUTH_SECRET = 'arrival-atlas-test-auth-secret';

  return store;
}

export async function resetTestStateStore(): Promise<void> {
  await clearAllPersistedDevState();
}

export function teardownTestStateStore(): void {
  if (activeTestDir) {
    rmSync(activeTestDir, { recursive: true, force: true });
    activeTestDir = null;
  }
}
