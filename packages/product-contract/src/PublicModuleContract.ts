import type { NormalizedCapabilities } from './NormalizedCapabilities.js';

export type PublicModuleContractStatus = 'available' | 'disabled' | 'restricted';

export type PublicModuleContractMetadata = {
  category?: string;
  icon?: string;
  entitlementKey?: string | null;
};

export type PublicModuleContract = {
  id: string;
  title: string;
  description: string;
  version: string;
  status: PublicModuleContractStatus;
  capabilities: NormalizedCapabilities;
  metadata: PublicModuleContractMetadata;
};
