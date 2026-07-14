import { isCertaintyLevel, validateCertaintyState } from '@/lib/certainty/validate-certainty-state';
import type { CertaintyLevel } from '@/lib/certainty/types';
import { DEFAULT_SURFACE_PRIORITIES, isKnownSurfacePriority } from './priority';
import type {
  CurrentSituationSource,
  RegisterSurfaceInput,
  SurfaceRegistration,
  ValidationErrorCode,
  ValidationResult,
} from './types';

const KNOWN_SOURCES = new Set<string>(Object.keys(DEFAULT_SURFACE_PRIORITIES));

export function isValidCurrentSituationSource(value: unknown): value is CurrentSituationSource {
  return typeof value === 'string' && KNOWN_SOURCES.has(value);
}

export function validateRegistration(input: RegisterSurfaceInput): ValidationResult {
  if (!isValidCurrentSituationSource(input.surface)) {
    return { ok: false, error: 'invalid_source' };
  }

  const priority = input.priority ?? DEFAULT_SURFACE_PRIORITIES[input.surface];
  if (!isKnownSurfacePriority(priority)) {
    return { ok: false, error: 'invalid_priority' };
  }

  if (!input.bundle?.state) {
    return { ok: false, error: 'missing_certainty' };
  }

  if (!validateCertaintyState(input.bundle.state)) {
    return { ok: false, error: 'invalid_certainty' };
  }

  if (input.bundle.state.confidence !== undefined && !isCertaintyLevel(input.bundle.state.confidence)) {
    return { ok: false, error: 'invalid_certainty' };
  }

  if (input.bundle.state.confidence === undefined) {
    return { ok: false, error: 'missing_certainty' };
  }

  return {
    ok: true,
    registration: {
      surface: input.surface,
      bundle: input.bundle,
      priority,
      registeredAt: Date.now(),
    },
  };
}

export function normalizeValidationError(error: ValidationErrorCode): ValidationErrorCode {
  return error;
}

export function assertValidConfidence(confidence: CertaintyLevel | undefined): confidence is CertaintyLevel {
  return confidence !== undefined && isCertaintyLevel(confidence);
}
