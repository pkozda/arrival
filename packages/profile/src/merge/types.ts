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

/**
 * Domain-owned input merge strategy registered by a module package.
 * Profile Engine orchestrates merge resolution; it does not implement domain logic.
 */
export interface ModuleMergeStrategy {
  moduleId: string;
  merge(params: MergeModuleInputParams, trace?: TraceCollector): MergeModuleInputResult;
}
