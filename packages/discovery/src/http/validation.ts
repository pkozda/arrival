import type { RegisterScheduleInput } from '../scheduler/types.js';

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

const ID_PATTERN = /^[\w.:@+/-]{1,128}$/;

export function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

export function validateScheduleId(scheduleId: string): ValidationResult<string> {
  if (!isSafeId(scheduleId)) {
    return { ok: false, message: 'Invalid scheduleId' };
  }
  return { ok: true, value: scheduleId };
}

export function validateRunId(runId: string): ValidationResult<string> {
  if (!isSafeId(runId)) {
    return { ok: false, message: 'Invalid runId' };
  }
  return { ok: true, value: runId };
}

/**
 * Structural validation only — scheduler owns semantic rules.
 */
export function validateRegisterScheduleBody(
  body: unknown
): ValidationResult<RegisterScheduleInput> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'Request body must be a JSON object' };
  }
  const o = body as Record<string, unknown>;

  // Reject unexpected nested objects that might carry secrets
  for (const [key, value] of Object.entries(o)) {
    if (value !== null && typeof value === 'object') {
      return { ok: false, message: `Field "${key}" must be a scalar` };
    }
  }

  if (!isSafeId(o.scheduleId)) {
    return { ok: false, message: 'scheduleId is required and must be a safe id' };
  }
  if (!isSafeId(o.profileId)) {
    return { ok: false, message: 'profileId is required and must be a safe id' };
  }
  if (!isSafeId(o.strategyId)) {
    return { ok: false, message: 'strategyId is required and must be a safe id' };
  }
  if (typeof o.strategyVersion !== 'string' || !o.strategyVersion.trim()) {
    return { ok: false, message: 'strategyVersion is required' };
  }
  if (typeof o.intervalSeconds !== 'number' || !Number.isFinite(o.intervalSeconds)) {
    return { ok: false, message: 'intervalSeconds must be a number' };
  }
  if (o.intervalSeconds <= 0) {
    return { ok: false, message: 'intervalSeconds must be positive' };
  }
  if (o.timezone !== undefined && typeof o.timezone !== 'string') {
    return { ok: false, message: 'timezone must be a string' };
  }
  if (o.enabled !== undefined && typeof o.enabled !== 'boolean') {
    return { ok: false, message: 'enabled must be a boolean' };
  }
  if (o.nextRunAt !== undefined) {
    if (typeof o.nextRunAt !== 'string' || Number.isNaN(Date.parse(o.nextRunAt))) {
      return { ok: false, message: 'nextRunAt must be a valid ISO timestamp' };
    }
  }

  const input: RegisterScheduleInput = {
    scheduleId: o.scheduleId,
    profileId: o.profileId,
    strategyId: o.strategyId,
    strategyVersion: o.strategyVersion.trim(),
    intervalSeconds: o.intervalSeconds,
  };
  if (typeof o.timezone === 'string') input.timezone = o.timezone;
  if (typeof o.enabled === 'boolean') input.enabled = o.enabled;
  if (typeof o.nextRunAt === 'string') input.nextRunAt = o.nextRunAt;

  return { ok: true, value: input };
}
