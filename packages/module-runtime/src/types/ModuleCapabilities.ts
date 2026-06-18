export type ModuleCapability =
  | 'produces-recommendations'
  | 'produces-actions'
  | 'produces-explanations'
  | 'requires-profile'
  | 'supports-scenarios'
  | 'supports-comparison';

export type ModuleCapabilities = {
  capabilities: readonly ModuleCapability[];
  requiredProfileFields: readonly string[];
  forbiddenProfileFields: readonly string[];
  entitlementKey: string | null;
};
