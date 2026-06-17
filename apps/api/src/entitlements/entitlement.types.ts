export type AccountTier = 'free' | 'premium' | 'enterprise';

export type ModuleAccessState = 'available' | 'locked' | 'premium-required';

export type AccountEntitlements = {
  accountId: string;
  tier: AccountTier;
  modules: string[];
  features: Record<string, string[]>;
  expiresAt?: string;
};

export function createDefaultEntitlements(accountId: string): AccountEntitlements {
  return {
    accountId,
    tier: 'free',
    modules: [],
    features: {},
  };
}
