import { ER_COPY_KEYS } from '@arrival-atlas/product-contract';
import type { ActionTemplate } from './types.js';

const profileHousing: ActionTemplate = {
  templateId: 'profile-housing',
  labelKey: ER_COPY_KEYS.ACTION_UPDATE_HOUSING,
  type: 'update_profile',
  payload: { profileKey: 'where-you-live', href: '/profile/where-you-live/edit' },
};

const profileMigration: ActionTemplate = {
  templateId: 'profile-migration',
  labelKey: ER_COPY_KEYS.ACTION_UPDATE_MIGRATION,
  type: 'update_profile',
  payload: { profileKey: 'move-to-germany', href: '/profile/move-to-germany/edit' },
};

const profileWorkIncome: ActionTemplate = {
  templateId: 'profile-work-income',
  labelKey: ER_COPY_KEYS.ACTION_UPDATE_WORK_INCOME,
  type: 'update_profile',
  payload: { profileKey: 'work-income', href: '/profile/work-income/edit' },
};

const profileBenefits: ActionTemplate = {
  templateId: 'profile-benefits',
  labelKey: ER_COPY_KEYS.ACTION_UPDATE_BENEFITS,
  type: 'update_profile',
  payload: { profileKey: 'benefits-support', href: '/profile/benefits-support/edit' },
};

const profileInsurance: ActionTemplate = {
  templateId: 'profile-insurance',
  labelKey: ER_COPY_KEYS.ACTION_UPDATE_INSURANCE,
  type: 'update_profile',
  payload: { profileKey: 'health-insurance', href: '/profile/health-insurance/edit' },
};

const economicRealityModule: ActionTemplate = {
  templateId: 'module-economic-reality',
  labelKey: ER_COPY_KEYS.ACTION_OPEN_ECONOMIC_REALITY,
  type: 'open_module',
  payload: {
    moduleId: 'economic-reality',
    entrypoint: 'auto',
    href: '/modules/economic-reality',
  },
};

const financialModule: ActionTemplate = {
  templateId: 'module-financial-reality',
  labelKey: ER_COPY_KEYS.ACTION_OPEN_FINANCIAL,
  type: 'open_module',
  payload: { moduleId: 'financial-reality', href: '/modules/financial-reality' },
};

const benefitsModule: ActionTemplate = {
  templateId: 'module-benefits-simulator',
  labelKey: ER_COPY_KEYS.ACTION_OPEN_BENEFITS,
  type: 'open_module',
  payload: { moduleId: 'benefits-simulator', href: '/modules/benefits-simulator' },
};

const healthcareModule: ActionTemplate = {
  templateId: 'module-healthcare-navigation',
  labelKey: ER_COPY_KEYS.ACTION_OPEN_HEALTHCARE,
  type: 'open_module',
  payload: { moduleId: 'healthcare-navigation', href: '/modules/healthcare-navigation' },
};

const jobcenterExternal: ActionTemplate = {
  templateId: 'external-jobcenter-intake',
  labelKey: ER_COPY_KEYS.ACTION_JOBCENTER_INTAKE,
  type: 'external_resource',
  payload: {
    href: '/resources/jobcenter/intake',
    externalSystem: 'jobcenter',
  },
};

const jobcenterAppointmentExternal: ActionTemplate = {
  templateId: 'external-jobcenter-appointment',
  labelKey: ER_COPY_KEYS.ACTION_JOBCENTER_APPOINTMENT,
  type: 'external_resource',
  payload: {
    href: '/resources/jobcenter/appointment-prep',
    externalSystem: 'jobcenter',
  },
};

const sozialamtExternal: ActionTemplate = {
  templateId: 'external-sozialamt-contact',
  labelKey: ER_COPY_KEYS.ACTION_SOZIALAMT_CONTACT,
  type: 'external_resource',
  payload: {
    href: '/resources/sozialamt/contact',
    externalSystem: 'sozialamt',
  },
};

const employmentAgencyExternal: ActionTemplate = {
  templateId: 'external-employment-agency',
  labelKey: ER_COPY_KEYS.ACTION_EMPLOYMENT_AGENCY,
  type: 'external_resource',
  payload: {
    href: '/resources/employment-agency/job-search',
    externalSystem: 'employment_agency',
  },
};

const crisisExternal: ActionTemplate = {
  templateId: 'external-crisis-resources',
  labelKey: ER_COPY_KEYS.ACTION_CRISIS_RESOURCES,
  type: 'external_resource',
  payload: { href: '/resources/crisis/local-support' },
};

function intent(
  templateId: string,
  systemIntent: NonNullable<ActionTemplate['payload']['systemIntent']>,
  labelKey: string,
  requiresConfirmation = false
): ActionTemplate {
  return {
    templateId,
    labelKey,
    type: 'system_intent',
    payload: {
      systemIntent,
      intentKey: labelKey,
    },
    requiresConfirmation,
  };
}

export const NODE_ACTION_CATALOG: Record<string, ActionTemplate[]> = {
  'g1-income-assess': [profileWorkIncome],
  'g1-residency-assess': [profileMigration],
  'g1-route-support': [benefitsModule, economicRealityModule],
  'g1-jobcenter-intent': [
    jobcenterExternal,
    intent(
      'intent-start-jobcenter',
      'start_jobcenter_process',
      ER_COPY_KEYS.INTENT_START_JOBCENTER
    ),
  ],
  'g1-sozialamt-intent': [
    sozialamtExternal,
    intent('intent-start-sozialamt', 'start_sozialamt_process', ER_COPY_KEYS.INTENT_START_SOZIALAMT),
  ],
  'g1-enter-system': [
    intent(
      'intent-initiate-benefit-application',
      'initiate_benefit_application',
      ER_COPY_KEYS.INTENT_INITIATE_BENEFIT_APPLICATION,
      true
    ),
  ],
  'g2-registration': [profileHousing, jobcenterExternal, economicRealityModule],
  'g2-termination-docs': [profileWorkIncome],
  'g2-jobcenter-appointment': [
    jobcenterAppointmentExternal,
    intent(
      'intent-start-jobcenter',
      'start_jobcenter_process',
      ER_COPY_KEYS.INTENT_START_JOBCENTER
    ),
    economicRealityModule,
  ],
  'g2-bank-account': [profileWorkIncome],
  'g2-first-payment': [financialModule],
  'g3-reporting': [
    intent(
      'intent-report-income',
      'report_income_change',
      ER_COPY_KEYS.INTENT_REPORT_INCOME_CHANGE
    ),
    profileBenefits,
  ],
  'g3-job-search': [employmentAgencyExternal],
  'g3-income-changes': [
    intent(
      'intent-report-income',
      'report_income_change',
      ER_COPY_KEYS.INTENT_REPORT_INCOME_CHANGE
    ),
    profileWorkIncome,
  ],
  'g3-insurance': [profileInsurance, healthcareModule],
  'g3-transition-plan': [financialModule, profileWorkIncome],
  'g4-offer-evaluation': [financialModule, benefitsModule],
  'g4-notify-jobcenter': [
    profileWorkIncome,
    intent(
      'intent-report-income',
      'report_income_change',
      ER_COPY_KEYS.INTENT_REPORT_INCOME_CHANGE
    ),
  ],
  'g4-benefit-exit': [profileBenefits],
  'g4-income-stability': [financialModule, profileWorkIncome],
  'g5-immediate-needs': [crisisExternal],
  'g5-system-entry': [
    intent(
      'intent-initiate-benefit-application',
      'initiate_benefit_application',
      ER_COPY_KEYS.INTENT_INITIATE_BENEFIT_APPLICATION,
      true
    ),
    economicRealityModule,
  ],
  'g5-registration': [profileHousing],
  'g5-appointment': [jobcenterAppointmentExternal],
  'g5-bridge-income': [financialModule],
  'g6-status-confirm': [profileMigration],
  'g6-sozialamt-contact': [
    profileBenefits,
    sozialamtExternal,
    intent('intent-start-sozialamt', 'start_sozialamt_process', ER_COPY_KEYS.INTENT_START_SOZIALAMT),
    economicRealityModule,
  ],
  'g6-arrival-proof': [profileHousing],
  'g6-payment-setup': [profileBenefits, profileWorkIncome],
  'g6-transition-awareness': [jobcenterExternal],
};

export function lookupNodeActionTemplates(nodeId: string): ActionTemplate[] {
  return NODE_ACTION_CATALOG[nodeId] ?? [];
}
