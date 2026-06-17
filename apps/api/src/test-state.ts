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
import { clearCoordinatorState } from './state/system-state-coordinator.js';

let activeTestDir: string | null = null;

export function setupTestStateStore(): FilePersistedSystemStateStore {
  if (activeTestDir) {
    rmSync(activeTestDir, { recursive: true, force: true });
  }

  activeTestDir = mkdtempSync(join(tmpdir(), 'arrivalos-state-test-'));
  const store = new FilePersistedSystemStateStore(activeTestDir);
  resetPersistedSystemStateStore(store);
  process.env.ARRIVALOS_STATE_DIR = activeTestDir;

  const accountsDir = join(activeTestDir, 'accounts');
  const accountStore = new FileAccountStore(accountsDir);
  resetAccountStore(accountStore);
  process.env.ARRIVALOS_ACCOUNTS_DIR = accountsDir;

  const entitlementsDir = join(activeTestDir, 'entitlements');
  const entitlementStore = new FileEntitlementStore(entitlementsDir);
  resetEntitlementStore(entitlementStore);
  process.env.ARRIVALOS_ENTITLEMENTS_DIR = entitlementsDir;

  const sessionsDir = join(activeTestDir, 'sessions-registry');
  const sessionRegistryStore = new FileSessionRegistryStore(sessionsDir);
  resetSessionRegistryStore(sessionRegistryStore);
  process.env.ARRIVALOS_SESSIONS_DIR = sessionsDir;

  process.env.ARRIVALOS_AUTH_SECRET = 'arrivalos-test-auth-secret';

  return store;
}

export async function resetTestStateStore(): Promise<void> {
  const stateDir =
    process.env.ARRIVALOS_STATE_DIR ?? join(tmpdir(), 'arrivalos-state-fallback');
  const store = new FilePersistedSystemStateStore(stateDir);
  await clearCoordinatorState(store);

  const accountsDir =
    process.env.ARRIVALOS_ACCOUNTS_DIR ?? join(stateDir, 'accounts');
  const accountStore = new FileAccountStore(accountsDir);
  await accountStore.clear();

  const entitlementsDir =
    process.env.ARRIVALOS_ENTITLEMENTS_DIR ?? join(stateDir, 'entitlements');
  const entitlementStore = new FileEntitlementStore(entitlementsDir);
  await entitlementStore.clear();

  const sessionsDir =
    process.env.ARRIVALOS_SESSIONS_DIR ?? join(stateDir, 'sessions-registry');
  const sessionRegistryStore = new FileSessionRegistryStore(sessionsDir);
  await sessionRegistryStore.clear();
}

export function teardownTestStateStore(): void {
  if (activeTestDir) {
    rmSync(activeTestDir, { recursive: true, force: true });
    activeTestDir = null;
  }
}
