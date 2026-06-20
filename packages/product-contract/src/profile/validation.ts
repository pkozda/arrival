import { isScenarioFieldId } from './scenario-fields.js';
import { isPersistentFactFieldId, PERSISTENT_FACT_FIELD_REGISTRY } from './field-registry.js';
import type { PersistentFactFieldId } from './field-registry.js';
import type { ProfileDomain } from './domains.js';
import type { MutationRequestPayload } from './domain-field-types.js';

export type MutationValidationIssue = {
  code:
    | 'SCENARIO_FIELD_IN_PAYLOAD'
    | 'UNKNOWN_FIELD_IN_PAYLOAD'
    | 'DOMAIN_FIELD_MISMATCH'
    | 'EMPTY_FACT_PAYLOAD';
  message: string;
  fieldId?: string;
};

export type MutationValidationResult =
  | { ok: true }
  | { ok: false; issues: MutationValidationIssue[] };

/** Returns field keys present in a domain_facts payload. */
export function extractDomainFactFieldKeys(payload: MutationRequestPayload): string[] {
  if (payload.kind !== 'domain_facts') {
    return [];
  }

  return Object.keys(payload.fields);
}

/**
 * Contract-level validation primitive — rejects scenario field IDs in persistent payloads.
 * Does not validate values; runtime engine adds domain rules in C2.
 */
export function validatePersistentPayloadFields(
  payload: MutationRequestPayload,
  expectedDomain?: ProfileDomain
): MutationValidationResult {
  const issues: MutationValidationIssue[] = [];

  if (payload.kind === 'empty' || payload.kind === 'pref') {
    return { ok: true };
  }

  if (expectedDomain && payload.domain !== expectedDomain) {
    issues.push({
      code: 'DOMAIN_FIELD_MISMATCH',
      message: `Payload domain ${payload.domain} does not match expected domain ${expectedDomain}`,
    });
  }

  const keys = extractDomainFactFieldKeys(payload);

  if (keys.length === 0) {
    issues.push({
      code: 'EMPTY_FACT_PAYLOAD',
      message: 'Domain fact payload must include at least one field',
    });
  }

  for (const key of keys) {
    if (isScenarioFieldId(key)) {
      issues.push({
        code: 'SCENARIO_FIELD_IN_PAYLOAD',
        message: `Scenario field "${key}" cannot be stored in profile mutations`,
        fieldId: key,
      });
      continue;
    }

    if (!isPersistentFactFieldId(key)) {
      issues.push({
        code: 'UNKNOWN_FIELD_IN_PAYLOAD',
        message: `Unknown field identifier "${key}"`,
        fieldId: key,
      });
      continue;
    }

    const definition = PERSISTENT_FACT_FIELD_REGISTRY[key as PersistentFactFieldId];
    if (definition.domain !== payload.domain) {
      issues.push({
        code: 'DOMAIN_FIELD_MISMATCH',
        message: `Field "${key}" belongs to domain "${definition.domain}", not "${payload.domain}"`,
        fieldId: key,
      });
    }
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true };
}

/** Type guard ensuring a string is a persistent fact field, not a scenario field. */
export function assertPersistentFactFieldId(
  fieldId: string
): asserts fieldId is PersistentFactFieldId {
  if (isScenarioFieldId(fieldId)) {
    throw new Error(`Field "${fieldId}" is scenario-only and cannot be used as PersistentFactFieldId`);
  }

  if (!isPersistentFactFieldId(fieldId)) {
    throw new Error(`Unknown persistent fact field: "${fieldId}"`);
  }
}
