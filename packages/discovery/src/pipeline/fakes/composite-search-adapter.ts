import type { DiscoveryQuery } from '../../types/query.js';
import type { RawCandidatePayload } from '../../types/candidate.js';
import type { AdapterContext, SearchAdapter } from '../adapters.js';
import { PartialSearchError } from '../adapters.js';

/**
 * Merges multiple search adapters. Successful hits are preserved when some providers fail.
 */
export function createCompositeSearchAdapter(adapters: SearchAdapter[]): SearchAdapter {
  return {
    async search(queries: DiscoveryQuery[], context: AdapterContext) {
      const results: RawCandidatePayload[] = [];
      const failures: string[] = [];
      for (const [index, adapter] of adapters.entries()) {
        try {
          const part = await adapter.search(queries, context);
          results.push(...part);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'unknown error';
          failures.push(`provider[${index}]:${message}`);
        }
      }
      if (failures.length > 0 && results.length > 0) {
        throw new PartialSearchError(results, failures);
      }
      if (failures.length > 0 && results.length === 0) {
        throw new PartialSearchError([], failures);
      }
      return results;
    },
  };
}
