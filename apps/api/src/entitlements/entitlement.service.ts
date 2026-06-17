import {
  createDefaultEntitlements,
  type AccountEntitlements,
  type AccountTier,
  type ModuleAccessState,
} from './entitlement.types.js';
import { getEntitlementStore, type EntitlementStore } from './entitlement.store.js';

export class ModuleAccessDeniedError extends Error {
  constructor(moduleId: string) {
    super(`Module access denied: ${moduleId}`);
    this.name = 'ModuleAccessDeniedError';
  }
}

export class EntitlementService {
  private get store(): EntitlementStore {
    return getEntitlementStore();
  }

  async createDefaultEntitlements(accountId: string): Promise<AccountEntitlements> {
    const entitlements = createDefaultEntitlements(accountId);
    await this.store.save(entitlements);
    return entitlements;
  }

  async getEntitlements(accountId: string): Promise<AccountEntitlements> {
    const stored = await this.store.getByAccountId(accountId);
    if (stored) {
      return stored;
    }
    return createDefaultEntitlements(accountId);
  }

  async saveEntitlements(entitlements: AccountEntitlements): Promise<AccountEntitlements> {
    await this.store.save(entitlements);
    return entitlements;
  }

  canExecuteModule(
    entitlements: AccountEntitlements,
    moduleId: string,
    accountId: string | null
  ): boolean {
    if (accountId === null) {
      return true;
    }

    if (entitlements.tier === 'premium' || entitlements.tier === 'enterprise') {
      return true;
    }

    return entitlements.modules.includes(moduleId);
  }

  assertModuleExecutionAllowed(
    entitlements: AccountEntitlements,
    moduleId: string,
    accountId: string | null
  ): void {
    if (!this.canExecuteModule(entitlements, moduleId, accountId)) {
      throw new ModuleAccessDeniedError(moduleId);
    }
  }

  resolveModuleAccess(
    entitlements: AccountEntitlements | null,
    moduleId: string,
    accountId: string | null
  ): ModuleAccessState | undefined {
    if (accountId === null) {
      return undefined;
    }

    const effective = entitlements ?? createDefaultEntitlements(accountId);

    if (effective.tier === 'premium' || effective.tier === 'enterprise') {
      return 'available';
    }

    if (effective.modules.includes(moduleId)) {
      return 'available';
    }

    return 'premium-required';
  }
}

export const entitlementService = new EntitlementService();

export function isPremiumTier(tier: AccountTier): boolean {
  return tier === 'premium' || tier === 'enterprise';
}
