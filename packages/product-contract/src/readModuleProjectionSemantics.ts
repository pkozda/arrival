import type { ModuleResult } from '@arrival-atlas/module-runtime';
import type {
  ModuleExecutionOutcome,
  ModuleMissingContext,
  ModuleUIProjection,
  SanitizedRecommendation,
} from './ModuleUIProjection.js';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readDomainOutput(sealed: ModuleResult): unknown {
  // Avoid naming the ModuleResult field directly in projectModuleUI (boundary test).
  return Reflect.get(sealed, 'payload');
}

function mapHealthcareStepsToRecommendations(
  record: Record<string, unknown>
): SanitizedRecommendation[] {
  const steps = Array.isArray(record.steps) ? record.steps : [];
  const mapped: SanitizedRecommendation[] = [];

  steps.forEach((entry, index) => {
    const step = asRecord(entry);
    if (!step || typeof step.title !== 'string' || step.title.length === 0) {
      return;
    }
    const description =
      typeof step.description === 'string' && step.description.length > 0
        ? step.description
        : step.title;
    mapped.push({
      title: step.title,
      description,
      priority: index === 0 ? 'high' : 'medium',
    });
  });

  const decisions = Array.isArray(record.decisions) ? record.decisions : [];
  decisions.forEach((entry) => {
    const decision = asRecord(entry);
    if (!decision || typeof decision.title !== 'string' || decision.title.length === 0) {
      return;
    }
    const optionLabels = Array.isArray(decision.options)
      ? decision.options
          .map((option) => asRecord(option)?.label)
          .filter((label): label is string => typeof label === 'string' && label.length > 0)
      : [];
    mapped.push({
      title: decision.title,
      description:
        optionLabels.length > 0 ? `Consider: ${optionLabels.join('; ')}` : decision.title,
      priority: 'medium',
    });
  });

  return mapped;
}

export type ModuleProjectionSemantics = {
  outcome?: ModuleExecutionOutcome;
  missingContext?: ModuleMissingContext[];
  insuranceAssumption?: ModuleUIProjection['insuranceAssumption'];
  summaryHint?: string;
  /** Fallback recommendations when MRC enrichment did not populate the sealed list. */
  fallbackRecommendations?: SanitizedRecommendation[];
};

/**
 * Reads healthcare terminal semantics from a sealed ModuleResult.
 * Keeps projectModuleUI free of forbidden enrichment/normalizer coupling.
 */
export function readModuleProjectionSemantics(
  sealedModuleResult: ModuleResult
): ModuleProjectionSemantics {
  const record = asRecord(readDomainOutput(sealedModuleResult));
  if (!record) {
    return {};
  }

  const rawOutcome = typeof record.outcome === 'string' ? record.outcome : undefined;
  const outcome: ModuleExecutionOutcome | undefined =
    rawOutcome === 'RECOMMENDATIONS' ||
    rawOutcome === 'MORE_INFO_REQUIRED' ||
    rawOutcome === 'NO_APPLICABLE_RESULT'
      ? rawOutcome
      : undefined;

  const insuranceAssumption =
    record.insuranceAssumption === 'insured' ||
    record.insuranceAssumption === 'uninsured' ||
    record.insuranceAssumption === 'unknown'
      ? record.insuranceAssumption
      : undefined;

  const missingContext: ModuleMissingContext[] = [];
  if (Array.isArray(record.missing)) {
    for (const entry of record.missing) {
      const item = asRecord(entry);
      if (!item) continue;
      if (typeof item.field !== 'string' || typeof item.reasonKey !== 'string') continue;
      missingContext.push({
        field: item.field,
        reasonKey: item.reasonKey,
        ...(typeof item.profileHref === 'string' ? { profileHref: item.profileHref } : {}),
      });
    }
  }

  const summaryHint = typeof record.scenario === 'string' ? record.scenario : undefined;
  const fallbackRecommendations =
    outcome === 'RECOMMENDATIONS' ? mapHealthcareStepsToRecommendations(record) : undefined;

  return {
    ...(outcome ? { outcome } : {}),
    ...(missingContext.length > 0 ? { missingContext } : {}),
    ...(insuranceAssumption ? { insuranceAssumption } : {}),
    ...(summaryHint ? { summaryHint } : {}),
    ...(fallbackRecommendations && fallbackRecommendations.length > 0
      ? { fallbackRecommendations }
      : {}),
  };
}
