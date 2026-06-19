import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Account } from './account.types.js';

export interface AccountStore {
  createAccount(account: Account): Promise<void>;
  getAccountById(id: string): Promise<Account | null>;
  updateAccount(account: Account): Promise<void>;
  listAccounts(): Promise<Account[]>;
  clear(): Promise<void>;
}

function accountFilePath(rootDir: string, accountId: string): string {
  const safeId = accountId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(rootDir, `${safeId}.json`);
}

export class FileAccountStore implements AccountStore {
  constructor(private readonly rootDir: string) {}

  private async ensureRoot(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
  }

  async createAccount(account: Account): Promise<void> {
    const existing = await this.getAccountById(account.id);
    if (existing) {
      throw new Error(`Account already exists: ${account.id}`);
    }
    await this.ensureRoot();
    await writeFile(accountFilePath(this.rootDir, account.id), JSON.stringify(account), 'utf8');
  }

  async getAccountById(id: string): Promise<Account | null> {
    try {
      const raw = await readFile(accountFilePath(this.rootDir, id), 'utf8');
      return JSON.parse(raw) as Account;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async updateAccount(account: Account): Promise<void> {
    const existing = await this.getAccountById(account.id);
    if (!existing) {
      throw new Error(`Account not found: ${account.id}`);
    }
    await this.ensureRoot();
    await writeFile(accountFilePath(this.rootDir, account.id), JSON.stringify(account), 'utf8');
  }

  async listAccounts(): Promise<Account[]> {
    try {
      const entries = await readdir(this.rootDir);
      const accounts = await Promise.all(
        entries
          .filter((entry) => entry.endsWith('.json'))
          .map(async (entry) => {
            const raw = await readFile(path.join(this.rootDir, entry), 'utf8');
            return JSON.parse(raw) as Account;
          })
      );
      return accounts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
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

let activeStore: AccountStore | null = null;

export function getAccountStore(): AccountStore {
  if (!activeStore) {
    const rootDir =
      process.env.ARRIVAL_ATLAS_ACCOUNTS_DIR ?? path.join(process.cwd(), '.arrival-atlas-accounts');
    activeStore = new FileAccountStore(rootDir);
  }
  return activeStore;
}

export function resetAccountStore(store: AccountStore): void {
  activeStore = store;
}

export function resolveDefaultAccountsDir(): string {
  return process.env.ARRIVAL_ATLAS_ACCOUNTS_DIR ?? path.join(process.cwd(), '.arrival-atlas-accounts');
}
