import type { DiscoveryQuery } from '../../types/query.js';
import type { RawCandidatePayload } from '../../types/candidate.js';
import type { SearchAdapter, AdapterContext } from '../adapters.js';
import { AdapterError } from '../adapters.js';

export type FakeSearchAdapterOptions = {
  resultsByQueryId?: Record<string, RawCandidatePayload[]>;
  /** If set, searching this query id throws AdapterError */
  failQueryId?: string;
  /** If true, every search throws */
  failAll?: boolean;
  defaultResults?: RawCandidatePayload[];
};

export function createFakeSearchAdapter(
  options: FakeSearchAdapterOptions = {}
): SearchAdapter {
  return {
    async search(queries: DiscoveryQuery[], _context: AdapterContext) {
      if (options.failAll) {
        throw new AdapterError('search', 'Simulated search failure');
      }
      const out: RawCandidatePayload[] = [];
      for (const query of queries) {
        if (options.failQueryId && query.id === options.failQueryId) {
          throw new AdapterError('search', `Simulated failure for query ${query.id}`);
        }
        const mapped = options.resultsByQueryId?.[query.id];
        if (mapped) {
          out.push(...mapped.map((r) => ({ ...r })));
        } else if (options.defaultResults) {
          out.push(...options.defaultResults.map((r) => ({ ...r })));
        }
      }
      return out;
    },
  };
}
