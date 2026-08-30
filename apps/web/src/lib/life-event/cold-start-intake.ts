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
    labelKey: 'life-event.intake.field.residencyStatus',
    type: 'select',
    contractDomain: 'migration',
    options: [
      { value: 'eu-citizen', labelKey: 'life-event.intake.option.residencyStatus.eu-citizen' },
      {
        value: 'permanent-resident',
        labelKey: 'life-event.intake.option.residencyStatus.permanent-resident',
      },
      {
        value: 'temporary-resident',
        labelKey: 'life-event.intake.option.residencyStatus.temporary-resident',
      },
      { value: 'asylum-seeker', labelKey: 'life-event.intake.option.residencyStatus.asylum-seeker' },
      { value: 'student-visa', labelKey: 'life-event.intake.option.residencyStatus.student-visa' },
      { value: 'work-visa', labelKey: 'life-event.intake.option.residencyStatus.work-visa' },
      { value: 'tourist', labelKey: 'life-event.intake.option.residencyStatus.tourist' },
      { value: 'unknown', labelKey: 'life-event.intake.option.residencyStatus.unknown' },
    ],
  },
  {
    formKey: 'city',
    labelKey: 'life-event.intake.field.city',
    type: 'text',
    contractDomain: 'housing',
    placeholderKey: 'life-event.intake.placeholder.city',
  },
  {
    formKey: 'employmentStatus',
    labelKey: 'life-event.intake.field.employmentStatus',
    type: 'select',
    contractDomain: 'employment',
    options: [
      { value: 'employed', labelKey: 'life-event.intake.option.employmentStatus.employed' },
      {
        value: 'self-employed',
        labelKey: 'life-event.intake.option.employmentStatus.self-employed',
      },
      { value: 'unemployed', labelKey: 'life-event.intake.option.employmentStatus.unemployed' },
      { value: 'part-time', labelKey: 'life-event.intake.option.employmentStatus.part-time' },
      { value: 'student', labelKey: 'life-event.intake.option.employmentStatus.student' },
    ],
  },
  {
    formKey: 'insuranceType',
    labelKey: 'life-event.intake.field.insuranceType',
    type: 'select',
    contractDomain: 'healthInsurance',
    options: [
      { value: 'public', labelKey: 'life-event.intake.option.insuranceType.public' },
      { value: 'private', labelKey: 'life-event.intake.option.insuranceType.private' },
      { value: 'none', labelKey: 'life-event.intake.option.insuranceType.none' },
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
