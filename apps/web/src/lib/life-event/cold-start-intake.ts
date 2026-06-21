import type { MutationRequest, ProfileDomain } from '@/lib/product-contract';
import { generateMutationRequestId } from '@/lib/mutations';
import {
  normalizeDraftFieldValue,
  type DomainDraftValues,
  type DomainEditFieldDefinition,
} from '@/lib/profile-correction';

export const LIFE_EVENT_COLD_START_FIELDS: DomainEditFieldDefinition[] = [
  {
    formKey: 'residencyStatus',
    label: 'Residency status',
    type: 'select',
    contractDomain: 'migration',
    options: [
      { value: 'eu-citizen', label: 'EU citizen' },
      { value: 'permanent-resident', label: 'Permanent resident' },
      { value: 'temporary-resident', label: 'Temporary resident' },
      { value: 'asylum-seeker', label: 'Asylum seeker' },
      { value: 'student-visa', label: 'Student visa' },
      { value: 'work-visa', label: 'Work visa' },
      { value: 'tourist', label: 'Tourist / visitor' },
      { value: 'unknown', label: 'Status not specified' },
    ],
  },
  {
    formKey: 'city',
    label: 'City in Germany',
    type: 'text',
    contractDomain: 'housing',
    placeholder: 'e.g. Berlin',
  },
  {
    formKey: 'employmentStatus',
    label: 'Employment status',
    type: 'select',
    contractDomain: 'employment',
    options: [
      { value: 'employed', label: 'Employed full-time' },
      { value: 'self-employed', label: 'Self-employed' },
      { value: 'unemployed', label: 'Unemployed' },
      { value: 'part-time', label: 'Part-time employed' },
      { value: 'student', label: 'Student' },
    ],
  },
  {
    formKey: 'insuranceType',
    label: 'Health insurance',
    type: 'select',
    contractDomain: 'healthInsurance',
    options: [
      { value: 'public', label: 'Public health insurance (GKV)' },
      { value: 'private', label: 'Private health insurance (PKV)' },
      { value: 'none', label: 'No coverage yet' },
    ],
  },
];

const REQUIRED_FIELD_KEYS = new Set(['residencyStatus', 'employmentStatus', 'insuranceType']);

export function validateColdStartIntakeDraft(draft: DomainDraftValues): string | null {
  for (const field of LIFE_EVENT_COLD_START_FIELDS) {
    if (!REQUIRED_FIELD_KEYS.has(field.formKey)) {
      continue;
    }
    const value = normalizeDraftFieldValue(field, draft[field.formKey]);
    if (value === undefined || value === '') {
      return field.formKey;
    }
  }
  return null;
}

function addDomainField(
  byDomain: Map<ProfileDomain, Record<string, unknown>>,
  domain: ProfileDomain,
  fieldId: string,
  value: unknown
): void {
  const fields = byDomain.get(domain) ?? {};
  fields[fieldId] = value;
  byDomain.set(domain, fields);
}

export function buildColdStartIntakeRequests(
  draft: DomainDraftValues,
  expectedHeadRevision: number
): MutationRequest[] {
  const byDomain = new Map<ProfileDomain, Record<string, unknown>>();

  for (const field of LIFE_EVENT_COLD_START_FIELDS) {
    const value = normalizeDraftFieldValue(field, draft[field.formKey]);
    if (value === undefined) {
      continue;
    }
    addDomainField(byDomain, field.contractDomain, field.formKey, value);
  }

  const insuranceType = byDomain.get('healthInsurance')?.insuranceType;
  if (insuranceType === 'none') {
    addDomainField(byDomain, 'healthInsurance', 'hasCoverage', false);
  } else if (insuranceType === 'public' || insuranceType === 'private') {
    addDomainField(byDomain, 'healthInsurance', 'hasCoverage', true);
  }

  const requests: MutationRequest[] = [];

  for (const [domain, fields] of byDomain.entries()) {
    if (Object.keys(fields).length === 0) {
      continue;
    }

    const requestId = generateMutationRequestId(`life-event-intake-${domain}`);
    requests.push({
      id: requestId,
      requestId,
      timestamp: new Date().toISOString(),
      type: 'fact.correct',
      intent: 'correction',
      domain,
      source: { kind: 'profile_ui', domain },
      payload: {
        kind: 'domain_facts',
        domain,
        fields,
      },
      confidence: 1,
      userConfirmationRequired: false,
      expectedHeadRevision,
    });
  }

  return requests;
}

export function shouldShowLifeEventPlanIntake(input: {
  planLoading: boolean;
  hasPlan: boolean;
  hasProfile: boolean;
  scenariosMode: boolean;
}): boolean {
  if (input.planLoading || input.hasPlan || input.hasProfile || input.scenariosMode) {
    return false;
  }
  return true;
}
