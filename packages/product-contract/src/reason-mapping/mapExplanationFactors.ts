import type { ExplanationFactor as RuntimeExplanationFactor } from '@arrivalos/module-runtime';
import type { ExplanationFactor } from '../ModuleExplanationView.js';

const FORBIDDEN_SOURCES = new Set(['trace', 'runtime', 'governance']);

const FORBIDDEN_PATTERNS = [
  /ENGINE_STEP/i,
  /INPUT_VALIDATED/i,
  /\bauthorized\b/i,
  /\bexecuted\b/i,
  /\bsealed\b/i,
  /\benriched\b/i,
  /pipeline/i,
  /normalizer/i,
  /governance/i,
  /registry/i,
];

function mapSourceToType(
  source: RuntimeExplanationFactor['source']
): ExplanationFactor['type'] | null {
  switch (source) {
    case 'input':
      return 'input';
    case 'rule':
    case 'calculation':
      return 'rule';
    case 'profile':
    case 'default':
      return 'context';
    default:
      return null;
  }
}

function formatLabel(factor: RuntimeExplanationFactor): string {
  if (factor.label.includes(String(factor.value))) {
    return factor.label;
  }

  return `${factor.label}: ${String(factor.value)}`;
}

function isForbiddenFactor(factor: RuntimeExplanationFactor): boolean {
  if (FORBIDDEN_SOURCES.has(factor.source)) {
    return true;
  }

  const haystack = `${factor.id} ${factor.label}`;
  return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(haystack));
}

export function mapExplanationFactors(
  factors: readonly RuntimeExplanationFactor[] | undefined
): ExplanationFactor[] {
  if (!factors) {
    return [];
  }

  const mapped: ExplanationFactor[] = [];

  for (const factor of factors) {
    if (isForbiddenFactor(factor)) {
      continue;
    }

    const type = mapSourceToType(factor.source);
    if (!type) {
      continue;
    }

    mapped.push({
      id: factor.id,
      label: formatLabel(factor),
      type,
      ...(factor.weight !== undefined ? { weight: factor.weight } : {}),
    });
  }

  return mapped;
}
