import {
  isMetaMutationType,
  isPersistentMutationType,
  MUTATION_SOURCE_REGISTRY,
  type FieldDelta,
  type MutationRequest,
  type MutationSource,
  type MutationType,
} from '@arrival-atlas/product-contract';
import type { ProfileState } from '../profile-state.js';
import {
  buildMutationReason,
  isRevisionRequiredType,
  normalizeMutationRequest,
} from '../normalize/normalize-mutation-request.js';

export type ConflictErrorCode =
  | 'REVISION_CONFLICT'
  | 'NOT_PERSISTENT'
  | 'UNAUTHORIZED_SOURCE'
  | 'EMPTY_DELTAS';

export type ConflictResolution =
  | {
      ok: true;
      fieldDeltas: FieldDelta[];
      reason: string;
    }
  | {
      ok: false;
      code: ConflictErrorCode;
      message: string;
    };

const SOURCE_ALLOWED_TYPES: Readonly<Record<MutationSource['kind'], readonly MutationType[]>> = {
  module: ['fact.create', 'fact.update', 'fact.propose_update'],
  profile_ui: ['fact.correct', 'fact.invalidate', 'fact.suggest_correction', 'pref.update'],
  system: ['fact.invalidate', 'fact.propose_update', 'pref.update'],
  header: ['pref.update'],
};

function isSourceAuthorized(request: MutationRequest): boolean {
  const allowed = SOURCE_ALLOWED_TYPES[request.source.kind];
  return allowed.includes(request.type);
}

/**
 * Conflict resolution per profile-mutation-model-v1 §4.
 * Builds field deltas; enforces revision guards for corrections.
 */
export function resolveMutationConflict(
  request: MutationRequest,
  state: ProfileState,
  headRevision: number
): ConflictResolution {
  if (isMetaMutationType(request.type)) {
    return {
      ok: false,
      code: 'NOT_PERSISTENT',
      message: `Mutation type ${request.type} cannot be committed to the event log`,
    };
  }

  if (!isPersistentMutationType(request.type)) {
    return {
      ok: false,
      code: 'NOT_PERSISTENT',
      message: `Mutation type ${request.type} is not persistent`,
    };
  }

  if (!isSourceAuthorized(request)) {
    return {
      ok: false,
      code: 'UNAUTHORIZED_SOURCE',
      message: `Source ${request.source.kind} may not initiate ${request.type}`,
    };
  }

  const sourceRegistry = MUTATION_SOURCE_REGISTRY[request.source.kind];
  const isFactMutation = request.type.startsWith('fact.');
  if (isFactMutation && !sourceRegistry.mayInitiateFactMutations) {
    return {
      ok: false,
      code: 'UNAUTHORIZED_SOURCE',
      message: `Source ${request.source.kind} may not initiate fact mutations`,
    };
  }

  if (request.type === 'pref.update' && !sourceRegistry.mayInitiatePrefMutations) {
    return {
      ok: false,
      code: 'UNAUTHORIZED_SOURCE',
      message: `Source ${request.source.kind} may not initiate preference mutations`,
    };
  }

  if (isRevisionRequiredType(request.type)) {
    if (request.expectedHeadRevision === undefined) {
      return {
        ok: false,
        code: 'REVISION_CONFLICT',
        message: 'expectedHeadRevision is required for correction mutations',
      };
    }

    if (request.expectedHeadRevision !== headRevision) {
      return {
        ok: false,
        code: 'REVISION_CONFLICT',
        message: `Expected head revision ${request.expectedHeadRevision}, current is ${headRevision}`,
      };
    }
  }

  const fieldDeltas = normalizeMutationRequest(request, state);

  if (fieldDeltas.length === 0) {
    return {
      ok: false,
      code: 'EMPTY_DELTAS',
      message: 'Mutation produced no field deltas',
    };
  }

  return {
    ok: true,
    fieldDeltas,
    reason: buildMutationReason(request),
  };
}
