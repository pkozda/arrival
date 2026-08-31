/**
 * External content trust boundary (E3.1).
 *
 * Fetched content is untrusted input. Adapters and pipeline must never:
 * - execute scripts from fetched pages
 * - evaluate arbitrary HTML/JS as code
 * - trust embedded instructions as engine policy
 * - allow page text to modify strategy configuration
 * - allow external content to bypass verification
 * - promote AI-generated / missing URLs as attributable Evidence
 *
 * This is an architectural boundary, not a scraping sanitizer.
 * EnginePolicy.externalContentUntrusted remains the engine invariant flag.
 */

import { AdapterFailureError } from './errors.js';

export const EXTERNAL_CONTENT_UNTRUSTED = true as const;

/**
 * Minimal source-attribution guard for adapter outputs that claim a real source URL.
 * Does not fetch or validate reachability — only blocks empty / fabricated placeholders
 * from becoming attributable evidence inputs.
 */
export function assertAttributableSourceUrl(
  sourceUrl: string | undefined | null,
  options?: { adapter?: string; operation?: string }
): asserts sourceUrl is string {
  const adapter = options?.adapter ?? 'adapter';
  const operation = options?.operation ?? 'source_attribution';
  const trimmed = typeof sourceUrl === 'string' ? sourceUrl.trim() : '';
  if (!trimmed) {
    throw new AdapterFailureError({
      code: 'POLICY_BLOCKED',
      message: 'Missing source URL — cannot attribute evidence',
      adapter,
      operation,
      retryable: false,
    });
  }
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.includes('ai-generated://') ||
    lower === 'about:blank'
  ) {
    throw new AdapterFailureError({
      code: 'POLICY_BLOCKED',
      message: 'Source URL is not attributable',
      adapter,
      operation,
      retryable: false,
    });
  }
}
