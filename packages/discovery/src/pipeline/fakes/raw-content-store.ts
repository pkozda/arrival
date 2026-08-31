/**
 * In-memory raw payload store for E2.2 fakes.
 * Keeps giant bodies out of DiscoveryCandidate.raw (ref only).
 */
export type StoredRawPayload = {
  body: string;
  contentType: string;
};

export type RawContentStore = {
  put: (ref: string, payload: StoredRawPayload) => void;
  get: (ref: string) => StoredRawPayload | undefined;
  has: (ref: string) => boolean;
};

export function createInMemoryRawContentStore(
  seed: Record<string, StoredRawPayload> = {}
): RawContentStore {
  const map = new Map<string, StoredRawPayload>();
  for (const [ref, payload] of Object.entries(seed)) {
    map.set(ref, { ...payload });
  }
  return {
    put(ref, payload) {
      map.set(ref, { ...payload });
    },
    get(ref) {
      const found = map.get(ref);
      return found ? { ...found } : undefined;
    },
    has(ref) {
      return map.has(ref);
    },
  };
}
