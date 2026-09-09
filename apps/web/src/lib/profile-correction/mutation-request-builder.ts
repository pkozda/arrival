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

/** Map draft dependentChildCount → authoritative children[] (ages preserved when possible). */
function childrenFromDependentCount(
  count: number,
  previous: Array<{ age: number }> | undefined
): Array<{ age: number }> {
  if (!Number.isFinite(count) || count <= 0) {
    return [];
  }
  const safeCount = Math.min(20, Math.floor(count));
  const prev = Array.isArray(previous) ? previous : [];
  if (safeCount === prev.length) {
    return prev;
  }
  if (safeCount < prev.length) {
    return prev.slice(0, safeCount);
  }
  return [
    ...prev,
    ...Array.from({ length: safeCount - prev.length }, () => ({ age: 0 })),
  ];
}

function collectChangedDomainFields(
  section: DomainEditSection,
  draft: DomainDraftValues,
  profile: Parameters<typeof readDraftValueFromProfile>[2]
): Map<ProfileDomain, Record<string, unknown>> {
  const byDomain = new Map<ProfileDomain, Record<string, unknown>>();

  for (const field of section.fields) {
    const normalized = normalizeDraftFieldValue(field, draft[field.formKey]);
    const currentRaw = readDraftValueFromProfile(field.formKey, field.contractDomain, profile);
    // Compare authoritative semantics (normalized), not raw draft shapes (e.g. 'true' vs true).
    const currentNormalized = normalizeDraftFieldValue(field, currentRaw);

    if (fieldsEqual(normalized, currentNormalized, field.type)) {
      continue;
    }

    if (normalized === undefined) {
      // Clears are handled by collectClearedDomainFields → fact.invalidate.
      continue;
    }

    const existing = byDomain.get(field.contractDomain) ?? {};

    if (field.formKey === 'dependentChildCount' && typeof normalized === 'number') {
      const previousChildren = profile?.domains?.household?.children as
        | Array<{ age: number }>
        | undefined;
      existing.children = childrenFromDependentCount(normalized, previousChildren);
    } else {
      existing[field.formKey] = normalized;
    }

    byDomain.set(field.contractDomain, existing);
  }

  return byDomain;
}

/**
 * E13 — When the editor explicitly clears a previously known fact (empty select/input),
 * emit fact.invalidate keys. Does not invent clears for never-set fields.
 */
function collectClearedDomainFields(
  section: DomainEditSection,
  draft: DomainDraftValues,
  profile: Parameters<typeof readDraftValueFromProfile>[2]
): Map<ProfileDomain, string[]> {
  const byDomain = new Map<ProfileDomain, string[]>();

  for (const field of section.fields) {
    if (field.type === 'boolean') {
      // Booleans reverse via explicit false (fact.correct), not invalidate-to-unknown.
      continue;
    }

    const normalized = normalizeDraftFieldValue(field, draft[field.formKey]);
    const currentRaw = readDraftValueFromProfile(field.formKey, field.contractDomain, profile);
    const currentNormalized = normalizeDraftFieldValue(field, currentRaw);

    if (normalized !== undefined || currentNormalized === undefined) {
      continue;
    }

    const existing = byDomain.get(field.contractDomain) ?? [];
    if (field.formKey === 'dependentChildCount') {
      existing.push('children');
    } else {
      existing.push(field.formKey);
    }
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

function buildFactInvalidateRequest(
  domain: ProfileDomain,
  fieldIds: string[],
  expectedHeadRevision: number
): MutationRequest {
  const requestId = generateMutationRequestId(`profile-invalidate-${domain}`);
  const fields: Record<string, unknown> = {};
  for (const fieldId of fieldIds) {
    fields[fieldId] = null;
  }

  return {
    id: requestId,
    requestId,
    timestamp: new Date().toISOString(),
    type: 'fact.invalidate',
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

  const clearedByDomain = collectClearedDomainFields(section, draft, profile);
  for (const [domain, fieldIds] of clearedByDomain.entries()) {
    if (fieldIds.length === 0) {
      continue;
    }
    requests.push(buildFactInvalidateRequest(domain, fieldIds, expectedHeadRevision));
  }

  return requests;
}
