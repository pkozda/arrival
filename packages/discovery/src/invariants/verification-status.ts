import type { VerificationCheck, VerificationResult, VerificationStatus } from '../types/verification.js';

/**
 * Derive VerificationStatus from checks.
 *
 * PASS  = every required check is TRUE
 * FAIL  = any required check is FALSE
 * UNKNOWN = no required FALSE AND at least one required UNKNOWN
 */
export function deriveVerificationStatus(checks: VerificationCheck[]): VerificationStatus {
  const required = checks.filter((check) => check.required);

  if (required.some((check) => check.outcome === 'FALSE')) {
    return 'FAIL';
  }

  if (required.some((check) => check.outcome === 'UNKNOWN')) {
    return 'UNKNOWN';
  }

  // No required FALSE/UNKNOWN: either no required checks, or all required TRUE
  if (required.length === 0 || required.every((check) => check.outcome === 'TRUE')) {
    return 'PASS';
  }

  return 'UNKNOWN';
}

export function withDerivedStatus(
  result: Omit<VerificationResult, 'status'> & { status?: VerificationStatus }
): VerificationResult {
  return {
    ...result,
    status: deriveVerificationStatus(result.checks),
  };
}
