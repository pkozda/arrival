import type { DataProvenanceEntry } from '@arrivalos/core';
import type { ProfileDocument } from '../types/profile-document.js';
import type { TraceCollector } from '../trace/trace-collector.js';

export interface MergeModuleInputParams {
  requestInput?: Record<string, unknown>;
  requestOverrides?: Record<string, unknown>;
  profile?: ProfileDocument | null;
}

export interface MergeModuleInputResult {
  merged: Record<string, unknown>;
  provenance: DataProvenanceEntry[];
}

type FieldResolver = (profile: ProfileDocument | null | undefined) => unknown;

interface ModuleInputFieldConfig {
  profile: FieldResolver;
  defaultValue: unknown;
}

const MODULE_INPUT_CONFIG: Record<string, Record<string, ModuleInputFieldConfig>> = {
  'financial-reality': {
    grossIncome: {
      profile: (p) => p?.employment?.grossMonthlyIncome,
      defaultValue: 0,
    },
    taxClass: {
      profile: (p) => p?.employment?.taxClass,
      defaultValue: 1,
    },
    churchTax: {
      profile: (p) => p?.employment?.churchTax,
      defaultValue: false,
    },
    householdSize: {
      profile: (p) => p?.household?.size,
      defaultValue: 1,
    },
    monthlyRent: {
      profile: (p) => p?.housing?.monthlyColdRent,
      defaultValue: 0,
    },
    employmentStatus: {
      profile: (p) => p?.employment?.status,
      defaultValue: 'employed',
    },
    maritalStatus: {
      profile: (p) => p?.household?.maritalStatus,
      defaultValue: 'single',
    },
  },
  'healthcare-navigation': {
    city: {
      profile: (p) => p?.location?.city,
      defaultValue: undefined,
    },
    hasInsurance: {
      profile: (p) => p?.insurance?.hasCoverage,
      defaultValue: false,
    },
    insuranceType: {
      profile: (p) => p?.insurance?.type,
      defaultValue: 'none',
    },
  },
};

/**
 * @internal Use resolveExecutionContext() as the single entry point.
 */
export function mergeModuleInput(
  moduleId: string,
  params: MergeModuleInputParams,
  trace?: TraceCollector
): MergeModuleInputResult {
  const config = MODULE_INPUT_CONFIG[moduleId];
  const requestInput = params.requestInput ?? {};
  const requestOverrides = params.requestOverrides ?? {};
  const profile = params.profile ?? null;

  const merged: Record<string, unknown> = { ...requestInput };
  const provenance: DataProvenanceEntry[] = [];

  if (!config) {
    for (const [field, value] of Object.entries(requestInput)) {
      if (value !== undefined) {
        provenance.push({ field, source: 'input' });
      }
    }
    return { merged, provenance };
  }

  for (const field of Object.keys(config).sort((a, b) => a.localeCompare(b))) {
    const fieldConfig = config[field]!;
    const resolved = resolveField(
      field,
      requestInput[field],
      requestOverrides[field],
      fieldConfig.profile(profile),
      fieldConfig.defaultValue
    );

    if (resolved.value !== undefined) {
      merged[field] = resolved.value;
      provenance.push({ field, source: resolved.source });
      recordMergeTraceStep(trace, field, resolved);
    }
  }

  for (const [field, value] of Object.entries(requestInput)) {
    if (!(field in config) && value !== undefined) {
      merged[field] = value;
      provenance.push({ field, source: 'input' });
    }
  }

  return { merged, provenance };
}

function recordMergeTraceStep(
  trace: TraceCollector | undefined,
  field: string,
  resolved: { value: unknown; source: DataProvenanceEntry['source'] }
): void {
  if (!trace) return;

  if (resolved.source === 'override') {
    trace.record({ type: 'INPUT_OVERRIDE', field, value: resolved.value });
  } else if (
    resolved.source === 'profile' ||
    resolved.source === 'input' ||
    resolved.source === 'default'
  ) {
    trace.record({
      type: 'MERGE_DECISION',
      field,
      source: resolved.source,
    });
  }

  trace.record({ type: 'FINAL_VALUE', field, value: resolved.value });
}

function resolveField(
  _field: string,
  requestValue: unknown,
  overrideValue: unknown,
  profileValue: unknown,
  defaultValue: unknown
): { value: unknown; source: DataProvenanceEntry['source'] } {
  if (requestValue !== undefined && requestValue !== null && requestValue !== '') {
    return { value: requestValue, source: 'input' };
  }
  if (overrideValue !== undefined && overrideValue !== null && overrideValue !== '') {
    return { value: overrideValue, source: 'override' };
  }
  if (profileValue !== undefined && profileValue !== null) {
    return { value: profileValue, source: 'profile' };
  }
  return { value: defaultValue, source: 'default' };
}
