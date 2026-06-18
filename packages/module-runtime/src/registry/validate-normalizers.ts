import type {
  ActionNormalizer,
  RecommendationNormalizer,
  ValidationResult,
} from './contract-types.js';
import {
  validateActionItemArray,
  validateRecommendationArray,
} from './validate-contract-shapes.js';

function payloadsAreEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function snapshotPayload(payload: unknown): unknown {
  return structuredClone(payload);
}

export function validateRecommendationNormalizer(
  normalizer: RecommendationNormalizer,
  samplePayloads: readonly unknown[]
): ValidationResult {
  const errors: string[] = [];

  if (typeof normalizer !== 'function') {
    return { valid: false, errors: ['Recommendation normalizer must be a function'] };
  }

  for (const payload of samplePayloads) {
    const snapshot = snapshotPayload(payload);

    let result: unknown;
    try {
      result = normalizer(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      errors.push(`Recommendation normalizer threw: ${message}`);
      continue;
    }

    if (!payloadsAreEqual(payload, snapshot)) {
      errors.push('Recommendation normalizer must not mutate input payload');
    }

    errors.push(...validateRecommendationArray(result));
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

export function validateActionNormalizer(
  normalizer: ActionNormalizer,
  moduleId: string,
  samplePayloads: readonly unknown[]
): ValidationResult {
  const errors: string[] = [];

  if (typeof normalizer !== 'function') {
    return { valid: false, errors: ['Action normalizer must be a function'] };
  }

  for (const payload of samplePayloads) {
    const snapshot = snapshotPayload(payload);

    let result: unknown;
    try {
      result = normalizer(moduleId, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      errors.push(`Action normalizer threw: ${message}`);
      continue;
    }

    if (!payloadsAreEqual(payload, snapshot)) {
      errors.push('Action normalizer must not mutate input payload');
    }

    errors.push(...validateActionItemArray(result));
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
