import type { PublicModuleContractMetadata } from './PublicModuleContract.js';

const MODULE_PRODUCT_METADATA: Record<string, PublicModuleContractMetadata> = {
  'financial-reality': {
    category: 'finance',
    icon: '€',
    entitlementKey: null,
  },
  'benefits-simulator': {
    category: 'benefits',
    icon: '🏛',
    entitlementKey: null,
  },
  'healthcare-navigation': {
    category: 'healthcare',
    icon: '+',
    entitlementKey: null,
  },
  'grocery-optimization': {
    category: 'daily-life',
    icon: '🛒',
    entitlementKey: null,
  },
  'system-translation': {
    category: 'language',
    icon: 'Aa',
    entitlementKey: null,
  },
  'life-event': {
    category: 'life-events',
    icon: '◎',
    entitlementKey: null,
  },
};

export function resolveProductMetadata(moduleId: string): PublicModuleContractMetadata {
  return MODULE_PRODUCT_METADATA[moduleId] ?? { entitlementKey: null };
}
