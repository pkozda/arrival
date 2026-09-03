import type { StrategyRegistry } from '../registry/strategy-registry.js';
import type {
  Criterion,
  CriterionValue,
  DiscoveryCriteria,
} from '../types/criteria.js';
import type { DiscoveryProfile } from '../types/profile.js';
import type { CreateDiscoveryProfileInput, ValidatedUpdateDiscoveryProfileInput } from './types.js';
import { emptyCriteria } from '../types/criteria.js';
import { DiscoveryUserValidationError } from './errors.js';

function isCriterionValue(value: unknown): value is CriterionValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function parseCriterion(value: unknown, path: string): Criterion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DiscoveryUserValidationError(`${path} must be an object`);
  }
  const o = value as Record<string, unknown>;
  if (typeof o.key !== 'string' || !o.key.trim()) {
    throw new DiscoveryUserValidationError(`${path}.key is required`);
  }
  if (!isCriterionValue(o.value)) {
    throw new DiscoveryUserValidationError(`${path}.value has invalid type`);
  }
  if (o.note !== undefined && typeof o.note !== 'string') {
    throw new DiscoveryUserValidationError(`${path}.note must be a string`);
  }
  return {
    key: o.key.trim(),
    value: o.value,
    ...(typeof o.note === 'string' ? { note: o.note } : {}),
  };
}

export function parseDiscoveryCriteria(value: unknown): DiscoveryCriteria {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DiscoveryUserValidationError('criteria must be an object');
  }
  const o = value as Record<string, unknown>;
  const buckets = ['required', 'preferred', 'excluded', 'flexible'] as const;
  const out = emptyCriteria();
  for (const bucket of buckets) {
    const raw = o[bucket];
    if (raw === undefined) continue;
    if (!Array.isArray(raw)) {
      throw new DiscoveryUserValidationError(`criteria.${bucket} must be an array`);
    }
    out[bucket] = raw.map((item, idx) =>
      parseCriterion(item, `criteria.${bucket}[${idx}]`)
    );
  }
  return out;
}

function parseSchedule(value: unknown): DiscoveryProfile['schedule'] {
  if (value === undefined) {
    return { cadence: 'manual' };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DiscoveryUserValidationError('schedule must be an object');
  }
  const o = value as Record<string, unknown>;
  if (o.cadence === 'manual') {
    return { cadence: 'manual' };
  }
  if (o.cadence === 'daily') {
    if (typeof o.hourUtc !== 'number' || o.hourUtc < 0 || o.hourUtc > 23) {
      throw new DiscoveryUserValidationError('schedule.hourUtc must be 0-23');
    }
    return { cadence: 'daily', hourUtc: o.hourUtc };
  }
  if (o.cadence === 'weekly') {
    if (typeof o.dayOfWeek !== 'number' || o.dayOfWeek < 0 || o.dayOfWeek > 6) {
      throw new DiscoveryUserValidationError('schedule.dayOfWeek must be 0-6');
    }
    if (typeof o.hourUtc !== 'number' || o.hourUtc < 0 || o.hourUtc > 23) {
      throw new DiscoveryUserValidationError('schedule.hourUtc must be 0-23');
    }
    return {
      cadence: 'weekly',
      dayOfWeek: o.dayOfWeek,
      hourUtc: o.hourUtc,
    };
  }
  throw new DiscoveryUserValidationError('schedule.cadence is invalid');
}

function parseNotification(
  value: unknown
): DiscoveryProfile['notification'] {
  if (value === undefined) {
    return { emailEnabled: true, skipEmptyDigest: true };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DiscoveryUserValidationError('notification must be an object');
  }
  const o = value as Record<string, unknown>;
  if (typeof o.emailEnabled !== 'boolean') {
    throw new DiscoveryUserValidationError('notification.emailEnabled must be boolean');
  }
  if (typeof o.skipEmptyDigest !== 'boolean') {
    throw new DiscoveryUserValidationError('notification.skipEmptyDigest must be boolean');
  }
  return {
    emailEnabled: o.emailEnabled,
    skipEmptyDigest: o.skipEmptyDigest,
  };
}

/** Merge partial notification updates onto existing profile preferences (E10.4). */
export function parseNotificationPatch(
  value: unknown,
  existing: DiscoveryProfile['notification']
): DiscoveryProfile['notification'] {
  if (value === undefined) {
    return { ...existing };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DiscoveryUserValidationError('notification must be an object');
  }
  const o = value as Record<string, unknown>;
  let emailEnabled = existing.emailEnabled;
  let skipEmptyDigest = existing.skipEmptyDigest;
  if (o.emailEnabled !== undefined) {
    if (typeof o.emailEnabled !== 'boolean') {
      throw new DiscoveryUserValidationError('notification.emailEnabled must be boolean');
    }
    emailEnabled = o.emailEnabled;
  }
  if (o.skipEmptyDigest !== undefined) {
    if (typeof o.skipEmptyDigest !== 'boolean') {
      throw new DiscoveryUserValidationError('notification.skipEmptyDigest must be boolean');
    }
    skipEmptyDigest = o.skipEmptyDigest;
  }
  return { emailEnabled, skipEmptyDigest };
}

export function assertStrategyExists(
  registry: StrategyRegistry,
  strategyId: string,
  strategyVersion: string
): void {
  if (!registry.has(strategyId, strategyVersion)) {
    throw new DiscoveryUserValidationError(
      `Unknown strategy: ${strategyId}@${strategyVersion}`
    );
  }
}

export function buildCreateProfileInput(
  body: unknown,
  registry: StrategyRegistry
): CreateDiscoveryProfileInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new DiscoveryUserValidationError('Request body must be a JSON object');
  }
  const o = body as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id.trim()) {
    throw new DiscoveryUserValidationError('id is required');
  }
  if (typeof o.name !== 'string' || !o.name.trim()) {
    throw new DiscoveryUserValidationError('name is required');
  }
  if (typeof o.strategyId !== 'string' || !o.strategyId.trim()) {
    throw new DiscoveryUserValidationError('strategyId is required');
  }
  if (typeof o.strategyVersion !== 'string' || !o.strategyVersion.trim()) {
    throw new DiscoveryUserValidationError('strategyVersion is required');
  }
  assertStrategyExists(registry, o.strategyId.trim(), o.strategyVersion.trim());
  const criteria = parseDiscoveryCriteria(o.criteria ?? emptyCriteria());
  const schedule = parseSchedule(o.schedule);
  const notification = parseNotification(o.notification);
  if (o.enabled !== undefined && typeof o.enabled !== 'boolean') {
    throw new DiscoveryUserValidationError('enabled must be a boolean');
  }
  return {
    id: o.id.trim(),
    name: o.name.trim(),
    strategyId: o.strategyId.trim(),
    strategyVersion: o.strategyVersion.trim(),
    criteria,
    schedule,
    notification,
    ...(typeof o.enabled === 'boolean' ? { enabled: o.enabled } : {}),
  };
}

export function buildUpdateProfileInput(
  body: unknown,
  existing: DiscoveryProfile
): ValidatedUpdateDiscoveryProfileInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new DiscoveryUserValidationError('Request body must be a JSON object');
  }
  const o = body as Record<string, unknown>;
  if (o.strategyId !== undefined || o.strategyVersion !== undefined) {
    throw new DiscoveryUserValidationError(
      'strategyId and strategyVersion are immutable after create'
    );
  }
  const input: ValidatedUpdateDiscoveryProfileInput = {};
  if (o.name !== undefined) {
    if (typeof o.name !== 'string' || !o.name.trim()) {
      throw new DiscoveryUserValidationError('name must be a non-empty string');
    }
    input.name = o.name.trim();
  }
  if (o.criteria !== undefined) {
    input.criteria = parseDiscoveryCriteria(o.criteria);
  }
  if (o.schedule !== undefined) {
    input.schedule = parseSchedule(o.schedule);
  }
  if (o.notification !== undefined) {
    input.notification = parseNotificationPatch(o.notification, existing.notification);
  }
  if (Object.keys(input).length === 0) {
    throw new DiscoveryUserValidationError('No updatable fields provided');
  }
  void existing;
  return input;
}
