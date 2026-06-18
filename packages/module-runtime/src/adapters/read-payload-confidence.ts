import type { ModuleResultMeta } from '../types/ModuleResult.js';

export function readPayloadConfidence(payload: unknown): ModuleResultMeta['confidence'] {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'medium';
  }

  const meta = (payload as { meta?: { confidence?: unknown } }).meta;
  if (
    meta?.confidence === 'high' ||
    meta?.confidence === 'medium' ||
    meta?.confidence === 'low'
  ) {
    return meta.confidence;
  }

  return 'medium';
}

export function readPayloadDisclaimer(payload: unknown): string | undefined {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }

  const meta = (payload as { meta?: { disclaimer?: unknown } }).meta;
  return typeof meta?.disclaimer === 'string' ? meta.disclaimer : undefined;
}
