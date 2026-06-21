import path from 'node:path';
import { FileAccountStore } from '../account/account.store.js';
import { FileEntitlementStore } from '../entitlements/entitlement.store.js';
import { FileSessionRegistryStore } from '../sessions/registry/session-registry.store.js';
import { sessionRegistryService } from '../sessions/registry/session-registry.service.js';
import {
  FilePersistedSystemStateStore,
  getPersistedSystemStateStore,
} from '../state/persisted-system-state-store.js';
import { clearCoordinatorState, systemStateCoordinator } from '../state/system-state-coordinator.js';

function resolveStateDir(): string {
  return process.env.ARRIVAL_ATLAS_STATE_DIR ?? path.join(process.cwd(), '.arrival-atlas-state');
}

export async function deleteSessionPersistedState(sessionId: string): Promise<boolean> {
  const store = getPersistedSystemStateStore();
  const existing = await store.load(sessionId);
  if (!existing) {
    return false;
  }

  await store.delete(sessionId);
  systemStateCoordinator.resetCache();

  const record = await sessionRegistryService.getSessionRecord(sessionId);
  if (record && record.status !== 'revoked') {
    await sessionRegistryService.revokeSession(sessionId);
  }

  return true;
}

export async function clearAllPersistedDevState(): Promise<void> {
  const stateDir = resolveStateDir();
  const store = new FilePersistedSystemStateStore(stateDir);
  await clearCoordinatorState(store);

  const accountsDir =
    process.env.ARRIVAL_ATLAS_ACCOUNTS_DIR ?? path.join(stateDir, 'accounts');
  await new FileAccountStore(accountsDir).clear();

  const entitlementsDir =
    process.env.ARRIVAL_ATLAS_ENTITLEMENTS_DIR ?? path.join(stateDir, 'entitlements');
  await new FileEntitlementStore(entitlementsDir).clear();

  const sessionsDir =
    process.env.ARRIVAL_ATLAS_SESSIONS_DIR ?? path.join(stateDir, 'sessions-registry');
  await new FileSessionRegistryStore(sessionsDir).clear();
}
