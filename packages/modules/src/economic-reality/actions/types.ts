import type { EconomicActionType, EconomicSystemIntent } from '@arrival-atlas/product-contract';

export type ActionTemplate = {
  templateId: string;
  labelKey: string;
  type: EconomicActionType;
  payload: {
    href?: string;
    moduleId?: string;
    profileKey?: string;
    externalSystem?: 'jobcenter' | 'sozialamt' | 'employment_agency';
    systemIntent?: EconomicSystemIntent;
    intentKey?: string;
    entrypoint?: 'auto' | 'CRISIS' | 'OVERVIEW' | 'PRIMARY';
  };
  requiresConfirmation?: boolean;
};

export const ACTION_TYPE_ORDER: Record<EconomicActionType, number> = {
  system_intent: 0,
  update_profile: 1,
  open_module: 2,
  external_resource: 3,
};
