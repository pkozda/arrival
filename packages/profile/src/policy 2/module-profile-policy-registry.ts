export type ModuleProfilePolicy = {
  moduleId: string;
  allowedFields: string[];
  sensitiveFields: string[];
  allowExtensions: boolean;
  allowedExtensions?: string[];
  redactFields?: string[];
};

export const FINANCIAL_REALITY_POLICY: ModuleProfilePolicy = {
  moduleId: 'financial-reality',
  allowedFields: ['preferredLanguage', 'employment', 'household', 'housing', 'location'],
  sensitiveFields: ['employment.grossMonthlyIncome', 'housing.monthlyColdRent'],
  allowExtensions: true,
  allowedExtensions: ['financial-reality'],
};

export const HEALTHCARE_NAVIGATION_POLICY: ModuleProfilePolicy = {
  moduleId: 'healthcare-navigation',
  allowedFields: ['preferredLanguage', 'location', 'insurance', 'residency'],
  sensitiveFields: [],
  allowExtensions: true,
  allowedExtensions: ['healthcare-navigation'],
};

/** Minimal access when no module-specific policy is registered */
export const DEFAULT_MODULE_POLICY: ModuleProfilePolicy = {
  moduleId: '*',
  allowedFields: ['preferredLanguage'],
  sensitiveFields: [],
  allowExtensions: false,
};

const REGISTRY = new Map<string, ModuleProfilePolicy>([
  [FINANCIAL_REALITY_POLICY.moduleId, FINANCIAL_REALITY_POLICY],
  [HEALTHCARE_NAVIGATION_POLICY.moduleId, HEALTHCARE_NAVIGATION_POLICY],
]);

export class ModuleProfilePolicyRegistry {
  register(policy: ModuleProfilePolicy): void {
    REGISTRY.set(policy.moduleId, policy);
  }

  getPolicy(moduleId: string): ModuleProfilePolicy {
    return REGISTRY.get(moduleId) ?? { ...DEFAULT_MODULE_POLICY, moduleId };
  }

  hasPolicy(moduleId: string): boolean {
    return REGISTRY.has(moduleId);
  }

  listPolicies(): ModuleProfilePolicy[] {
    return Array.from(REGISTRY.values());
  }
}

export const moduleProfilePolicyRegistry = new ModuleProfilePolicyRegistry();

export function getModuleProfilePolicy(moduleId: string): ModuleProfilePolicy {
  return moduleProfilePolicyRegistry.getPolicy(moduleId);
}
