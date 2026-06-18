import type { JsonSchema } from './JsonSchema.js';
import type { NormalizedCapabilities } from './NormalizedCapabilities.js';
import type { PublicModuleContractMetadata } from './PublicModuleContract.js';

export type ContractSnapshot = {
  contractVersion: '1.0';
  moduleId: string;
  title: string;
  version: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  capabilities: NormalizedCapabilities;
  metadata: PublicModuleContractMetadata;
  frozenAt: string;
};
