import type { ProfileDocument, ProfilePatch } from '../types/profile-document.js';

export function deepMergeProfile(
  base: ProfileDocument,
  patch: ProfilePatch
): ProfileDocument {
  return {
    ...base,
    schemaVersion: patch.schemaVersion ?? base.schemaVersion,
    preferredLanguage: patch.preferredLanguage ?? base.preferredLanguage,
    countryOfOrigin: patch.countryOfOrigin ?? base.countryOfOrigin,
    location: mergeOptionalObject(base.location, patch.location),
    residency: mergeOptionalObject(base.residency, patch.residency),
    household:
      patch.household !== undefined
        ? ({ ...(base.household ?? {}), ...patch.household } as ProfileDocument['household'])
        : base.household,
    employment: mergeOptionalObject(base.employment, patch.employment),
    housing: mergeOptionalObject(base.housing, patch.housing),
    insurance: mergeOptionalObject(base.insurance, patch.insurance),
    benefits: mergeOptionalObject(base.benefits, patch.benefits),
    extensions: mergeExtensions(base.extensions, patch.extensions),
  };
}

function mergeOptionalObject<T extends object>(
  base: T | undefined,
  patch: Partial<T> | undefined
): T | undefined {
  if (!base && !patch) return undefined;
  if (!patch) return base;
  return { ...(base ?? {}), ...patch } as T;
}

function mergeExtensions(
  base: Record<string, Record<string, unknown>>,
  patch: Record<string, Record<string, unknown>> | undefined
): Record<string, Record<string, unknown>> {
  if (!patch) return base;
  const result = { ...base };
  for (const [namespace, values] of Object.entries(patch)) {
    result[namespace] = { ...(result[namespace] ?? {}), ...values };
  }
  return result;
}

export function collectChangedFields(
  before: ProfileDocument,
  after: ProfileDocument
): string[] {
  const changed = new Set<string>();
  collectTopLevelChanges(before, after, changed);
  return Array.from(changed).sort();
}

function collectTopLevelChanges(
  before: ProfileDocument,
  after: ProfileDocument,
  changed: Set<string>
): void {
  const keys: (keyof ProfileDocument)[] = [
    'schemaVersion',
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
  ];

  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed.add(String(key));
    }
  }
}

export function createEmptyProfileDocument(
  partial: Partial<ProfileDocument> = {}
): ProfileDocument {
  return {
    schemaVersion: partial.schemaVersion ?? '1.0.0',
    preferredLanguage: partial.preferredLanguage ?? 'en',
    countryOfOrigin: partial.countryOfOrigin,
    location: partial.location,
    residency: partial.residency,
    household: partial.household,
    employment: partial.employment,
    housing: partial.housing,
    insurance: partial.insurance,
    benefits: partial.benefits,
    extensions: partial.extensions ?? {},
  };
}
