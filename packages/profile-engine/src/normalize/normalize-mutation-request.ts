import {
  isPersistentFactFieldId,
  type FieldDelta,
  type MutationRequest,
  type MutationType,
  type PersistentFactFieldId,
} from '@arrival-atlas/product-contract';
import type { ProfileState } from '../profile-state.js';

function beforeValue(state: ProfileState, fieldId: PersistentFactFieldId): unknown | null {
  return state.fields[fieldId]?.value ?? null;
}

function deltasFromDomainFacts(
  state: ProfileState,
  fields: Record<string, unknown>,
  operation: 'set' | 'clear'
): FieldDelta[] {
  const deltas: FieldDelta[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (!isPersistentFactFieldId(key)) {
      continue;
    }

    deltas.push({
      fieldId: key,
      before: beforeValue(state, key),
      after: operation === 'clear' ? null : value,
      operation,
    });
  }

  return deltas;
}

/** Convert validated MutationRequest payload into committed field deltas. */
export function normalizeMutationRequest(
  request: MutationRequest,
  state: ProfileState
): FieldDelta[] {
  if (request.payload.kind === 'empty') {
    return [];
  }

  if (request.payload.kind === 'pref') {
    const fieldId = request.payload.field as PersistentFactFieldId;
    return [
      {
        fieldId,
        before: beforeValue(state, fieldId),
        after: request.payload.value,
        operation: 'set',
      },
    ];
  }

  const operation: FieldDelta['operation'] =
    request.type === 'fact.invalidate' ? 'clear' : 'set';

  return deltasFromDomainFacts(state, request.payload.fields, operation);
}

export function buildMutationReason(request: MutationRequest): string {
  if (request.source.kind === 'module') {
    return `Updated when you used ${request.source.moduleId}`;
  }

  if (request.source.kind === 'profile_ui') {
    return 'You updated this in Your situation';
  }

  if (request.source.kind === 'system') {
    return `System update: ${request.source.reason}`;
  }

  return `Preference update: ${request.source.prefField}`;
}

export function isRevisionRequiredType(type: MutationType): boolean {
  return type === 'fact.correct' || type === 'fact.invalidate';
}
