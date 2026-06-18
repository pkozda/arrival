import type { ModuleResult } from '../types/ModuleResult.js';
import { deepClone } from '../utils/deepClone.js';

export function sealModuleResult(
  envelope: ModuleResult,
  legacyData: unknown
): ModuleResult {
  if (envelope.status !== 'success') {
    return envelope;
  }

  const sealed: ModuleResult = {
    ...envelope,
    meta: { ...envelope.meta },
    payload: deepClone(envelope.payload),
  };

  if (envelope.recommendations !== undefined) {
    sealed.recommendations = deepClone(envelope.recommendations);
  }

  if (envelope.explanation !== undefined) {
    sealed.explanation = deepClone(envelope.explanation);
  }

  if (envelope.actions !== undefined) {
    sealed.actions = deepClone(envelope.actions);
  }

  if (legacyData !== undefined && sealed.payload !== undefined) {
    // MEM-02: sealed payload must not share reference with legacy.data.
    void legacyData;
  }

  return sealed;
}
