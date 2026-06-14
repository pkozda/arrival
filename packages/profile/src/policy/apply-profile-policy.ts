import type { ProfileDocument } from '../types/profile-document.js';
import type { ProfileSlice } from '../types/profile-slice.js';
import type { TraceCollector } from '../trace/trace-collector.js';
import type { ModuleProfilePolicy } from './module-profile-policy-registry.js';

const TOP_LEVEL_PROFILE_KEYS = new Set([
  'preferredLanguage',
  'countryOfOrigin',
  'location',
  'residency',
  'household',
  'employment',
  'housing',
  'insurance',
  'benefits',
  'extensions',
  'schemaVersion',
]);

function cloneValue<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return structuredClone(value);
}

function deleteDotPath(target: Record<string, unknown>, dotPath: string): void {
  const parts = dotPath.split('.');
  if (parts.length === 1) {
    delete target[parts[0]!];
    return;
  }

  let current: Record<string, unknown> | undefined = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    if (!current || typeof current[key] !== 'object' || current[key] === null) {
      return;
    }
    current = current[key] as Record<string, unknown>;
  }

  if (current) {
    delete current[parts[parts.length - 1]!];
  }
}

function pickAllowedTopLevel(
  document: ProfileDocument,
  allowedFields: string[]
): Record<string, unknown> {
  const picked: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (!TOP_LEVEL_PROFILE_KEYS.has(field) || field === 'extensions') continue;
    const value = document[field as keyof ProfileDocument];
    if (value !== undefined) {
      picked[field] = cloneValue(value);
    }
  }

  return picked;
}

function applyExtensionPolicy(
  document: ProfileDocument,
  policy: ModuleProfilePolicy
): Record<string, unknown> | undefined {
  if (!policy.allowExtensions) {
    return undefined;
  }

  const allowedNamespaces = new Set(
    policy.allowedExtensions ?? [policy.moduleId]
  );
  const filtered: Record<string, unknown> = {};

  for (const [namespace, value] of Object.entries(document.extensions)) {
    if (allowedNamespaces.has(namespace)) {
      filtered[namespace] = cloneValue(value);
    }
  }

  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

function redactPaths(
  target: Record<string, unknown>,
  paths: string[]
): void {
  for (const path of paths) {
    deleteDotPath(target, path);
  }
}

function pruneEmptyObjects(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(pruneEmptyObjects);
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(obj)) {
      const pruned = pruneEmptyObjects(nested);
      if (pruned !== undefined) {
        next[key] = pruned;
      }
    }
    return Object.keys(next).length > 0 ? next : undefined;
  }
  return value;
}

/**
 * Produce a policy-constrained ProfileSlice for module context exposure.
 * Sensitive dot-paths are redacted; disallowed top-level domains are excluded.
 */
function recordPolicyTraceSteps(
  profile: ProfileDocument,
  modulePolicy: ModuleProfilePolicy,
  trace?: TraceCollector
): void {
  if (!trace) return;

  trace.record({ type: 'POLICY_APPLIED', policyId: modulePolicy.moduleId });

  const allowedFields = [...modulePolicy.allowedFields].sort((a, b) =>
    a.localeCompare(b)
  );
  for (const field of allowedFields) {
    if (field === 'extensions') continue;
    const value = profile[field as keyof ProfileDocument];
    if (value !== undefined) {
      trace.record({ type: 'FIELD_ALLOWED', field });
    }
  }

  const redactedPaths = [
    ...modulePolicy.sensitiveFields,
    ...(modulePolicy.redactFields ?? []),
  ].sort((a, b) => a.localeCompare(b));

  for (const field of redactedPaths) {
    trace.record({ type: 'FIELD_REDACTED', field });
  }
}

export function applyProfilePolicy(
  profile: ProfileDocument,
  modulePolicy: ModuleProfilePolicy,
  trace?: TraceCollector
): ProfileSlice {
  recordPolicyTraceSteps(profile, modulePolicy, trace);

  const picked = pickAllowedTopLevel(profile, modulePolicy.allowedFields);

  redactPaths(picked, modulePolicy.sensitiveFields);
  if (modulePolicy.redactFields) {
    redactPaths(picked, modulePolicy.redactFields);
  }

  for (const [key, value] of Object.entries(picked)) {
    const pruned = pruneEmptyObjects(value);
    if (pruned === undefined) {
      delete picked[key];
    } else {
      picked[key] = pruned;
    }
  }

  const slice: ProfileSlice = {
    preferredLanguage:
      (picked.preferredLanguage as ProfileDocument['preferredLanguage']) ??
      profile.preferredLanguage,
  };

  for (const field of modulePolicy.allowedFields) {
    if (field === 'preferredLanguage' || field === 'extensions') continue;
    const value = picked[field];
    if (value !== undefined) {
      (slice as unknown as Record<string, unknown>)[field] = value;
    }
  }

  const extensions = applyExtensionPolicy(profile, modulePolicy);
  if (extensions) {
    slice.extensions = extensions;
  }

  return slice;
}

/**
 * Document view for input merge and legacy context shims.
 * Includes full nested data within allowed top-level domains (including sensitive paths).
 */
export function buildPolicyConstrainedDocument(
  profile: ProfileDocument,
  modulePolicy: ModuleProfilePolicy
): Partial<ProfileDocument> {
  const constrained: Partial<ProfileDocument> = {
    schemaVersion: profile.schemaVersion,
    preferredLanguage: profile.preferredLanguage,
  };

  for (const field of modulePolicy.allowedFields) {
    if (field === 'preferredLanguage' || field === 'extensions') continue;
    const value = profile[field as keyof ProfileDocument];
    if (value !== undefined) {
      (constrained as Record<string, unknown>)[field] = cloneValue(value);
    }
  }

  if (modulePolicy.redactFields) {
    redactPaths(constrained as Record<string, unknown>, modulePolicy.redactFields);
  }

  return constrained;
}
