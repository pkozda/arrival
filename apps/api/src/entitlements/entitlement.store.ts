import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AccountEntitlements } from './entitlement.types.js';

export interface EntitlementStore {
  save(entitlements: AccountEntitlements): Promise<void>;
  getByAccountId(accountId: string): Promise<AccountEntitlements | null>;
  delete(accountId: string): Promise<void>;
  clear(): Promise<void>;
}

function entitlementFilePath(rootDir: string, accountId: string): string {
  const safeId = accountId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(rootDir, `${safeId}.json`);
}

export class FileEntitlementStore implements EntitlementStore {
  constructor(private readonly rootDir: string) {}

  private async ensureRoot(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
  }

  async save(entitlements: AccountEntitlements): Promise<void> {
    await this.ensureRoot();
    await writeFile(
      entitlementFilePath(this.rootDir, entitlements.accountId),
      JSON.stringify(entitlements),
      'utf8'
    );
  }

  async getByAccountId(accountId: string): Promise<AccountEntitlements | null> {
    try {
      const raw = await readFile(entitlementFilePath(this.rootDir, accountId), 'utf8');
      return JSON.parse(raw) as AccountEntitlements;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async delete(accountId: string): Promise<void> {
    try {
      await rm(entitlementFilePath(this.rootDir, accountId));
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

let activeStore: EntitlementStore | null = null;

export function getEntitlementStore(): EntitlementStore {
  if (!activeStore) {
    const rootDir =
      process.env.ARRIVAL_ATLAS_ENTITLEMENTS_DIR ??
      path.join(process.cwd(), '.arrival-atlas-entitlements');
    activeStore = new FileEntitlementStore(rootDir);
  }
  return activeStore;
}

export function resetEntitlementStore(store: EntitlementStore): void {
  activeStore = store;
}
