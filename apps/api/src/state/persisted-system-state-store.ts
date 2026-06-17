import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeSystemStateAccountId } from './system-state-account.js';
import type { SystemState } from './system-state-types.js';

export interface PersistedSystemStateStore {
  load(sessionId: string): Promise<SystemState | null>;
  save(state: SystemState): Promise<void>;
  delete(sessionId: string): Promise<void>;
  clear(): Promise<void>;
}

function sessionFilePath(rootDir: string, sessionId: string): string {
  const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(rootDir, `${safeId}.json`);
}

export class FilePersistedSystemStateStore implements PersistedSystemStateStore {
  constructor(private readonly rootDir: string) {}

  private async ensureRoot(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
  }

  async load(sessionId: string): Promise<SystemState | null> {
    try {
      const raw = await readFile(sessionFilePath(this.rootDir, sessionId), 'utf8');
      return normalizeSystemStateAccountId(JSON.parse(raw) as SystemState);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async save(state: SystemState): Promise<void> {
    await this.ensureRoot();
    const filePath = sessionFilePath(this.rootDir, state.session.id);
    await writeFile(filePath, JSON.stringify(state), 'utf8');
  }

  async delete(sessionId: string): Promise<void> {
    try {
      await rm(sessionFilePath(this.rootDir, sessionId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async clear(): Promise<void> {
    try {
      const entries = await readdir(this.rootDir);
      await Promise.all(
        entries
          .filter((entry) => entry.endsWith('.json'))
          .map((entry) => rm(path.join(this.rootDir, entry)))
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

let activeStore: PersistedSystemStateStore | null = null;

export function getPersistedSystemStateStore(): PersistedSystemStateStore {
  if (!activeStore) {
    const rootDir =
      process.env.ARRIVALOS_STATE_DIR ?? path.join(process.cwd(), '.arrivalos-state');
    activeStore = new FilePersistedSystemStateStore(rootDir);
  }
  return activeStore;
}

export function resetPersistedSystemStateStore(store: PersistedSystemStateStore): void {
  activeStore = store;
}

export function resolveDefaultStateDir(): string {
  return process.env.ARRIVALOS_STATE_DIR ?? path.join(process.cwd(), '.arrivalos-state');
}
