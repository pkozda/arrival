import type { ValidationResult } from './contract-types.js';

export function validateModuleRegistrationBatch(
  registrations: readonly { id: string }[]
): ValidationResult {
  const seen = new Set<string>();
  const errors: string[] = [];

  for (const registration of registrations) {
    if (seen.has(registration.id)) {
      errors.push(`duplicate moduleId "${registration.id}"`);
      continue;
    }

    seen.add(registration.id);
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
