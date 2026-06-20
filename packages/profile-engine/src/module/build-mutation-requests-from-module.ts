import type {
  MutationRequest,
  PersistentFactFieldId,
  ProfileDomain,
  SupportedLanguage,
} from '@arrival-atlas/product-contract';

type ModuleFieldMapping = {
  inputKey: string;
  domain: ProfileDomain;
  fieldId: PersistentFactFieldId;
  transform?: (value: unknown) => unknown;
};

const MODULE_ACTIVATION_FIELD_MAP: Record<string, ModuleFieldMapping[]> = {
  'financial-reality': [
    {
      inputKey: 'grossIncome',
      domain: 'income',
      fieldId: 'grossMonthlyIncome',
      transform: (value) => Number(value),
    },
    { inputKey: 'employmentStatus', domain: 'employment', fieldId: 'employmentStatus' },
    { inputKey: 'maritalStatus', domain: 'household', fieldId: 'maritalStatus' },
    {
      inputKey: 'monthlyRent',
      domain: 'housing',
      fieldId: 'monthlyColdRent',
      transform: (value) => Number(value),
    },
    {
      inputKey: 'householdSize',
      domain: 'household',
      fieldId: 'householdSize',
      transform: (value) => Number(value),
    },
  ],
  'healthcare-navigation': [
    {
      inputKey: 'hasInsurance',
      domain: 'healthInsurance',
      fieldId: 'hasCoverage',
      transform: (value) => Boolean(value),
    },
    { inputKey: 'insuranceType', domain: 'healthInsurance', fieldId: 'insuranceType' },
  ],
};

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

export type BuildModuleMutationRequestsParams = {
  moduleId: string;
  executionId: string;
  input: Record<string, unknown>;
  existingFieldIds: ReadonlySet<PersistentFactFieldId>;
  preferredLanguage?: SupportedLanguage;
  timestamp?: string;
};

/**
 * Maps module execution activation input to typed MutationRequest batch.
 * One request per domain; scenario fields are excluded by field registry mapping.
 */
export function buildMutationRequestsFromModuleExecution(
  params: BuildModuleMutationRequestsParams
): MutationRequest[] {
  const mappings = MODULE_ACTIVATION_FIELD_MAP[params.moduleId] ?? [];
  const timestamp = params.timestamp ?? new Date().toISOString();
  const byDomain = new Map<ProfileDomain, Record<string, unknown>>();

  for (const mapping of mappings) {
    const raw = params.input[mapping.inputKey];
    if (!isPresent(raw)) {
      continue;
    }

    const value = mapping.transform ? mapping.transform(raw) : raw;
    const fields = byDomain.get(mapping.domain) ?? {};
    fields[mapping.fieldId] = value;
    byDomain.set(mapping.domain, fields);
  }

  const requests: MutationRequest[] = [];

  for (const [domain, fields] of byDomain) {
    if (Object.keys(fields).length === 0) {
      continue;
    }

    const fieldIds = Object.keys(fields) as PersistentFactFieldId[];
    const hasExisting = fieldIds.some((fieldId) => params.existingFieldIds.has(fieldId));

    requests.push({
      id: `${params.executionId}:${domain}`,
      requestId: `${params.executionId}:${domain}`,
      timestamp,
      type: hasExisting ? 'fact.update' : 'fact.create',
      intent: 'capture',
      domain,
      source: {
        kind: 'module',
        moduleId: params.moduleId,
        executionId: params.executionId,
      },
      payload: {
        kind: 'domain_facts',
        domain,
        fields,
      },
      confidence: 1,
      userConfirmationRequired: false,
    });
  }

  if (params.preferredLanguage) {
    requests.push({
      id: `${params.executionId}:pref:language`,
      requestId: `${params.executionId}:pref:language`,
      timestamp,
      type: 'pref.update',
      intent: 'preference',
      domain: 'preferences',
      source: { kind: 'module', moduleId: params.moduleId, executionId: params.executionId },
      payload: {
        kind: 'pref',
        field: 'preferredLanguage',
        value: params.preferredLanguage,
      },
      confidence: 1,
      userConfirmationRequired: false,
    });
  }

  return requests;
}
