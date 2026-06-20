import type { MutationRequest, ProfileDomain } from '@/lib/product-contract';
import { generateMutationRequestId } from '@/lib/mutations';
import type { DomainDraftValues, DomainEditFieldDefinition, DomainEditSection } from './domain-field-definitions';
import {
  isSupportedLanguage,
  isThemePreference,
  normalizeDraftFieldValue,
  readDraftValueFromProfile,
} from './domain-field-definitions';

function fieldsEqual(
  left: unknown,
  right: unknown,
  fieldType: DomainEditFieldDefinition['type']
): boolean {
  if (fieldType === 'boolean') {
    return (left === true) === (right === true);
  }

  return left === right;
}

function collectChangedDomainFields(
  section: DomainEditSection,
  draft: DomainDraftValues,
  profile: Parameters<typeof readDraftValueFromProfile>[2]
): Map<ProfileDomain, Record<string, unknown>> {
  const byDomain = new Map<ProfileDomain, Record<string, unknown>>();

  for (const field of section.fields) {
    const normalized = normalizeDraftFieldValue(field, draft[field.formKey]);
    const current = readDraftValueFromProfile(field.formKey, field.contractDomain, profile);

    if (fieldsEqual(normalized, current, field.type)) {
      continue;
    }

    if (normalized === undefined) {
      continue;
    }

    const existing = byDomain.get(field.contractDomain) ?? {};
    existing[field.formKey] = normalized;
    byDomain.set(field.contractDomain, existing);
  }

  return byDomain;
}

function buildFactCorrectRequest(
  domain: ProfileDomain,
  fields: Record<string, unknown>,
  expectedHeadRevision: number
): MutationRequest {
  const requestId = generateMutationRequestId(`profile-${domain}`);

  return {
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
    } as MutationRequest['payload'],
    confidence: 1,
    userConfirmationRequired: true,
    expectedHeadRevision,
  };
}

function buildPrefUpdateRequest(
  field: DomainEditFieldDefinition,
  value: string | boolean | number
): MutationRequest {
  const requestId = generateMutationRequestId(`profile-pref-${field.formKey}`);

  if (field.formKey === 'preferredLanguage' && typeof value === 'string' && isSupportedLanguage(value)) {
    return {
      id: requestId,
      requestId,
      timestamp: new Date().toISOString(),
      type: 'pref.update',
      intent: 'preference',
      domain: 'preferences',
      source: { kind: 'profile_ui', domain: 'preferences' },
      payload: {
        kind: 'pref',
        field: 'preferredLanguage',
        value,
      },
      confidence: 1,
      userConfirmationRequired: false,
    };
  }

  if (field.formKey === 'theme' && typeof value === 'string' && isThemePreference(value)) {
    return {
      id: requestId,
      requestId,
      timestamp: new Date().toISOString(),
      type: 'pref.update',
      intent: 'preference',
      domain: 'preferences',
      source: { kind: 'profile_ui', domain: 'preferences' },
      payload: {
        kind: 'pref',
        field: 'theme',
        value,
      },
      confidence: 1,
      userConfirmationRequired: false,
    };
  }

  throw new Error('Unsupported preference correction');
}

export function buildDomainCorrectionRequests(
  section: DomainEditSection,
  draft: DomainDraftValues,
  profile: Parameters<typeof readDraftValueFromProfile>[2],
  expectedHeadRevision: number
): MutationRequest[] {
  const requests: MutationRequest[] = [];

  if (section.slug === 'language-display') {
    for (const field of section.fields) {
      const normalized = normalizeDraftFieldValue(field, draft[field.formKey]);
      const current = readDraftValueFromProfile(field.formKey, field.contractDomain, profile);
      if (fieldsEqual(normalized, current, field.type) || normalized === undefined) {
        continue;
      }
      requests.push(buildPrefUpdateRequest(field, normalized));
    }
    return requests;
  }

  const changedByDomain = collectChangedDomainFields(section, draft, profile);

  for (const [domain, fields] of changedByDomain.entries()) {
    if (Object.keys(fields).length === 0) {
      continue;
    }
    requests.push(buildFactCorrectRequest(domain, fields, expectedHeadRevision));
  }

  return requests;
}
