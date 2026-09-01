import { sanitizeAdapterDiagnosticMessage } from '../adapter-infra/lifecycle.js';
import { sanitizeRuntimeErrorMessage } from '../runtime/runtime-config.js';
import type { DiscoveryTelemetryAttributes } from './types.js';

const FORBIDDEN_KEYS =
  /^(authorization|cookie|set-cookie|api[_-]?key|password|secret|token|bot[_-]?token|bearer|prompt|raw(Html|Content|Response|Body)?|html|pageContent)$/i;

/**
 * Strip unsafe attribute keys and sanitize string values for telemetry.
 */
export function sanitizeTelemetryAttributes(
  attributes: DiscoveryTelemetryAttributes | undefined,
  secrets: readonly string[] = []
): DiscoveryTelemetryAttributes | undefined {
  if (!attributes) return undefined;
  const out: DiscoveryTelemetryAttributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (FORBIDDEN_KEYS.test(key)) continue;
    if (value === undefined) continue;
    if (typeof value === 'string') {
      let safe = sanitizeAdapterDiagnosticMessage(value) ?? '[redacted]';
      safe = sanitizeRuntimeErrorMessage(safe, secrets);
      // Drop oversized blobs (likely HTML / prompts)
      if (safe.length > 500) {
        safe = `${safe.slice(0, 500)}…[truncated]`;
      }
      out[key] = safe;
    } else {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function assertTelemetryEventHasNoSecrets(
  serialized: string,
  secrets: readonly string[]
): void {
  for (const secret of secrets) {
    const trimmed = secret?.trim();
    if (trimmed && trimmed.length >= 8 && serialized.includes(trimmed)) {
      throw new Error('Telemetry event leaked a secret');
    }
  }
}
