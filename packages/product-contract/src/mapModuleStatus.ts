import type { PublicModuleContractStatus } from './PublicModuleContract.js';

export type ModuleStatusInput = {
  enabled: boolean;
  entitlementAllowed?: boolean;
};

export function mapModuleStatus(input: ModuleStatusInput): PublicModuleContractStatus {
  if (!input.enabled) {
    return 'disabled';
  }

  if (input.entitlementAllowed === false) {
    return 'restricted';
  }

  return 'available';
}
