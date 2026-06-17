import { randomUUID } from 'node:crypto';
import type { Account } from './account.types.js';
import { getAccountStore, type AccountStore } from './account.store.js';
import { entitlementService } from '../entitlements/entitlement.service.js';

function nowIso(): string {
  return new Date().toISOString();
}

export class AccountService {
  private get store(): AccountStore {
    return getAccountStore();
  }

  async createAccount(): Promise<Account> {
    const timestamp = nowIso();
    const account: Account = {
      id: randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp,
      authProvider: null,
      authSubject: null,
      status: 'active',
    };

    await this.store.createAccount(account);
    await entitlementService.createDefaultEntitlements(account.id);
    return account;
  }

  async getAccount(id: string): Promise<Account | null> {
    return this.store.getAccountById(id);
  }

  async updateAccount(account: Account): Promise<Account> {
    const updated: Account = {
      ...account,
      updatedAt: nowIso(),
    };
    await this.store.updateAccount(updated);
    return updated;
  }
}

export const accountService = new AccountService();
