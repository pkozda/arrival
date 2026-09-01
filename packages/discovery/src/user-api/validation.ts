import type { ResultState } from '../types/state.js';
import type { ValidationResult } from '../http/validation.js';

const RESULT_STATES: readonly ResultState[] = [
  'NEW',
  'SEEN',
  'NOTIFIED',
  'OPENED',
  'SAVED',
  'DISMISSED',
  'EXPIRED',
];

const PROFILE_ID_PATTERN = /^[\w.:@+/_-]{1,128}$/;

export function validateProfileId(profileId: string): ValidationResult<string> {
  if (!PROFILE_ID_PATTERN.test(profileId)) {
    return { ok: false, message: 'Invalid profileId' };
  }
  return { ok: true, value: profileId };
}

export function validateResultId(resultId: string): ValidationResult<string> {
  if (typeof resultId !== 'string' || !resultId.trim() || resultId.length > 512) {
    return { ok: false, message: 'Invalid resultId' };
  }
  if (resultId.includes('/') || resultId.includes('\0')) {
    return { ok: false, message: 'Invalid resultId' };
  }
  return { ok: true, value: resultId };
}

export function validateUserStateBody(
  body: unknown
): ValidationResult<ResultState> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'Request body must be a JSON object' };
  }
  const o = body as Record<string, unknown>;
  if (typeof o.userState !== 'string') {
    return { ok: false, message: 'userState is required' };
  }
  if (!RESULT_STATES.includes(o.userState as ResultState)) {
    return { ok: false, message: 'userState is invalid' };
  }
  return { ok: true, value: o.userState as ResultState };
}
