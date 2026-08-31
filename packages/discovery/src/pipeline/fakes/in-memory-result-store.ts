import type { CandidateIdentity } from '../../types/candidate.js';
import type { DiscoveryResult } from '../../types/result.js';
import { resultIdentityKey, type ResultStore } from '../result-store.js';
import type { ResultWriter } from '../result-writer.js';
import { ResultWriterError } from '../result-writer.js';

/**
 * In-memory ResultStore + ResultWriter for E2.6/E2.7 tests.
 * findByIdentity remains observationally read-only (returns clones).
 * create/update mutate the store for persistence tests.
 */
export function createInMemoryResultStore(
  seed: DiscoveryResult[] = []
): ResultStore &
  ResultWriter & {
    seed: (results: DiscoveryResult[]) => void;
    snapshot: () => DiscoveryResult[];
    size: () => number;
  } {
  let results: DiscoveryResult[] = seed.map((r) => structuredClone(r));

  return {
    seed(next) {
      results = next.map((r) => structuredClone(r));
    },
    async findByIdentity(
      profileId: string,
      identity: CandidateIdentity,
      identityFingerprintFields: readonly string[]
    ) {
      const key = resultIdentityKey(identity, identityFingerprintFields);
      const found = results.find(
        (r) =>
          r.profileId === profileId &&
          resultIdentityKey(r.identity, identityFingerprintFields) === key
      );
      return found ? structuredClone(found) : null;
    },
    async create(result: DiscoveryResult) {
      if (results.some((r) => r.id === result.id)) {
        throw new ResultWriterError(`Result already exists: ${result.id}`);
      }
      const copy = structuredClone(result);
      results = [...results, copy];
      return structuredClone(copy);
    },
    async update(result: DiscoveryResult) {
      const idx = results.findIndex((r) => r.id === result.id);
      if (idx < 0) {
        throw new ResultWriterError(`Result not found: ${result.id}`);
      }
      const copy = structuredClone(result);
      results = [
        ...results.slice(0, idx),
        copy,
        ...results.slice(idx + 1),
      ];
      return structuredClone(copy);
    },
    snapshot() {
      return results.map((r) => structuredClone(r));
    },
    size() {
      return results.length;
    },
  };
}
