import type { ModuleExecutionResult } from '@arrival-atlas/core';
import {
  buildUXActionPlan,
  type UXActionCard,
  type UXSource,
} from '@arrival-atlas/ux';

const UX_SOURCES = new Set<UXSource>([
  'financial-reality',
  'healthcare-navigation',
  'system-translation',
  'benefits-simulator',
  'life-event',
  'grocery-optimization',
]);

export type UxEnrichedExecutionResult<T = unknown> = ModuleExecutionResult<T> & {
  ux?: {
    actions: UXActionCard[];
    summary: string;
  };
};

export type UxModuleOutput = {
  domain: UXSource;
  result: unknown;
};

export function isUxSource(moduleId: string): moduleId is UXSource {
  return UX_SOURCES.has(moduleId as UXSource);
}

export function isAtlasUxEnabled(): boolean {
  const flag = process.env.ATLAS_UX_ENABLED;
  if (flag === undefined) return true;
  return flag !== 'false' && flag !== '0';
}

export function collectUxModuleOutputs<T>(
  result: ModuleExecutionResult<T>,
  additionalOutputs: UxModuleOutput[] = []
): UxModuleOutput[] {
  const outputs = [...additionalOutputs];

  if (result.success && result.data !== undefined && isUxSource(result.moduleId)) {
    outputs.unshift({
      domain: result.moduleId,
      result: result.data,
    });
  }

  return outputs;
}

export function attachUxToExecutionResult<T>(
  result: ModuleExecutionResult<T>,
  additionalOutputs: UxModuleOutput[] = []
): UxEnrichedExecutionResult<T> {
  if (!result.success || !isAtlasUxEnabled()) {
    return result;
  }

  try {
    const moduleOutputs = collectUxModuleOutputs(result, additionalOutputs);
    const uxPlan = buildUXActionPlan(moduleOutputs);

    return {
      ...result,
      ux: {
        actions: uxPlan.actions,
        summary: uxPlan.summary,
      },
    };
  } catch {
    return result;
  }
}

export type UxSnapshotPayload = {
  actionCards: UXActionCard[];
  prioritySignals: ReturnType<typeof buildUXActionPlan>['signals'];
  attentionLayer: UXActionCard[];
};

export function buildUxSnapshot(moduleOutputs: UxModuleOutput[]): UxSnapshotPayload {
  if (!isAtlasUxEnabled()) {
    return {
      actionCards: [],
      prioritySignals: [],
      attentionLayer: [],
    };
  }

  try {
    const uxPlan = buildUXActionPlan(moduleOutputs);
    const attentionLayer = uxPlan.actions.filter((action) => action.priority === 'high').slice(0, 2);

    return {
      actionCards: uxPlan.actions,
      prioritySignals: uxPlan.signals,
      attentionLayer,
    };
  } catch {
    return {
      actionCards: [],
      prioritySignals: [],
      attentionLayer: [],
    };
  }
}
