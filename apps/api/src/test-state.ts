import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  return store;
}

export async function resetTestStateStore(): Promise<void> {
  const store = new FilePersistedSystemStateStore(
    process.env.ARRIVALOS_STATE_DIR ?? join(tmpdir(), 'arrivalos-state-fallback')
  );
  await clearCoordinatorState(store);
}

export function teardownTestStateStore(): void {
  if (activeTestDir) {
    rmSync(activeTestDir, { recursive: true, force: true });
    activeTestDir = null;
  }
}
