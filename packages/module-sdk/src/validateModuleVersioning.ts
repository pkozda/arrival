import { compareSemver, parseSemver } from './defineModuleVersion.js';
import type { SdkModuleFingerprints } from './types/SdkModuleDefinition.js';

export type ModuleVersionBaselineEntry = {
  version: string;
  inputSchemaHash: string;
  outputSchemaHash: string;
  capabilitiesHash: string;
  recommendationShapeHash: string;
  actionShapeHash: string;
};

export type ModuleVersionBaseline = {
  version: string;
  modules: Record<string, ModuleVersionBaselineEntry>;
};

export type VersioningViolation = {
  moduleId: string;
  code: string;
  message: string;
};

function requiredBumpForChange(params: {
  inputChanged: boolean;
  outputChanged: boolean;
  capabilitiesChanged: boolean;
  recommendationShapeChanged: boolean;
  actionShapeChanged: boolean;
}): 'major' | 'minor' | 'patch' | null {
  if (params.inputChanged || params.outputChanged || params.capabilitiesChanged) {
    return 'major';
  }

  if (params.recommendationShapeChanged || params.actionShapeChanged) {
    return 'minor';
  }

  return null;
}

function bumpMatches(params: {
  previous: string;
  next: string;
  required: 'major' | 'minor' | 'patch';
}): boolean {
  const prev = parseSemver(params.previous);
  const next = parseSemver(params.next);

  if (params.required === 'major') {
    return next.major > prev.major;
  }

  if (params.required === 'minor') {
    return next.major > prev.major || next.minor > prev.minor;
  }

  return compareSemver(params.next, params.previous) >= 0;
}

export function validateModuleVersioning(params: {
  moduleId: string;
  version: string;
  baseline?: ModuleVersionBaselineEntry;
  fingerprints: SdkModuleFingerprints;
}): VersioningViolation[] {
  const violations: VersioningViolation[] = [];

  if (!params.baseline) {
    return violations;
  }

  const inputChanged = params.fingerprints.inputSchemaHash !== params.baseline.inputSchemaHash;
  const outputChanged = params.fingerprints.outputSchemaHash !== params.baseline.outputSchemaHash;
  const capabilitiesChanged =
    params.fingerprints.capabilitiesHash !== params.baseline.capabilitiesHash;
  const recommendationShapeChanged =
    params.fingerprints.recommendationShapeHash !== params.baseline.recommendationShapeHash;
  const actionShapeChanged =
    params.fingerprints.actionShapeHash !== params.baseline.actionShapeHash;

  const requiredBump = requiredBumpForChange({
    inputChanged,
    outputChanged,
    capabilitiesChanged,
    recommendationShapeChanged,
    actionShapeChanged,
  });

  const anyChange =
    inputChanged ||
    outputChanged ||
    capabilitiesChanged ||
    recommendationShapeChanged ||
    actionShapeChanged;

  if (!anyChange) {
    if (params.version !== params.baseline.version) {
      violations.push({
        moduleId: params.moduleId,
        code: 'VERSION_DRIFT_WITHOUT_CHANGE',
        message: `Module "${params.moduleId}" version changed without schema or contract drift`,
      });
    }
    return violations;
  }

  if (requiredBump === null) {
    return violations;
  }

  if (!bumpMatches({ previous: params.baseline.version, next: params.version, required: requiredBump })) {
    violations.push({
      moduleId: params.moduleId,
      code: 'SEMVER_POLICY_VIOLATION',
      message: `Module "${params.moduleId}" requires ${requiredBump} version bump (baseline ${params.baseline.version}, current ${params.version})`,
    });
  }

  return violations;
}

export function validateModuleVersioningCatalog(params: {
  modules: Array<{
    moduleId: string;
    version: string;
    fingerprints: SdkModuleFingerprints;
  }>;
  baseline: ModuleVersionBaseline;
}): VersioningViolation[] {
  const violations: VersioningViolation[] = [];

  for (const moduleEntry of params.modules) {
    violations.push(
      ...validateModuleVersioning({
        moduleId: moduleEntry.moduleId,
        version: moduleEntry.version,
        baseline: params.baseline.modules[moduleEntry.moduleId],
        fingerprints: moduleEntry.fingerprints,
      })
    );
  }

  for (const moduleId of Object.keys(params.baseline.modules)) {
    if (!params.modules.some((entry) => entry.moduleId === moduleId)) {
      violations.push({
        moduleId,
        code: 'MISSING_MODULE',
        message: `Baseline module "${moduleId}" is missing from SDK catalog`,
      });
    }
  }

  return violations;
}
