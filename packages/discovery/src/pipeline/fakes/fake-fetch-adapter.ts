import type { RawContentRef } from '../../types/candidate.js';
import type {
  AdapterContext,
  FetchAdapter,
  FetchRequest,
  FetchResult,
} from '../adapters.js';
import type { RawContentStore } from './raw-content-store.js';
import { createInMemoryRawContentStore } from './raw-content-store.js';
import {
  COLLECT_PARSE_FIXTURES,
  type CollectParseFixtureId,
} from './fixtures.js';

export type FakeFetchAdapterOptions = {
  /** Map candidateId → fixture id */
  fixtureByCandidateId?: Record<string, CollectParseFixtureId>;
  /** Map URL → fixture id */
  fixtureByUrl?: Record<string, CollectParseFixtureId>;
  /** Candidate ids that fail fetch */
  failCandidateIds?: string[];
  /** URLs that fail fetch */
  failUrls?: string[];
  /** Shared content store (created if omitted) */
  contentStore?: RawContentStore;
  /** Default fixture when no map entry */
  defaultFixtureId?: CollectParseFixtureId;
};

export type FakeFetchAdapter = FetchAdapter & {
  contentStore: RawContentStore;
};

/**
 * Deterministic FetchAdapter — no network.
 * Stores fixture bodies in RawContentStore; returns RawContentRef only.
 */
export function createFakeFetchAdapter(
  options: FakeFetchAdapterOptions = {}
): FakeFetchAdapter {
  const contentStore =
    options.contentStore ?? createInMemoryRawContentStore();
  let seq = 0;

  const adapter: FakeFetchAdapter = {
    contentStore,
    async fetch(request: FetchRequest, context: AdapterContext): Promise<FetchResult> {
      if (options.failCandidateIds?.includes(request.candidateId)) {
        return {
          ok: false,
          reasonCode: 'FETCH_FAILED',
          message: `Simulated fetch failure for ${request.candidateId}`,
          sourceUrl: request.url,
        };
      }
      if (options.failUrls?.includes(request.url)) {
        return {
          ok: false,
          reasonCode: 'FETCH_FAILED',
          message: `Simulated fetch failure for url ${request.url}`,
          sourceUrl: request.url,
        };
      }

      const fixtureId =
        options.fixtureByCandidateId?.[request.candidateId] ??
        options.fixtureByUrl?.[request.url] ??
        options.defaultFixtureId;

      if (!fixtureId) {
        return {
          ok: false,
          reasonCode: 'FETCH_FAILED',
          message: `No fixture mapped for ${request.candidateId}`,
          sourceUrl: request.url,
        };
      }

      const fixture = COLLECT_PARSE_FIXTURES[fixtureId];
      seq += 1;
      const ref = `fixture:${fixtureId}:${context.run.id}:${seq}`;
      contentStore.put(ref, {
        body: fixture.body,
        contentType: fixture.contentType,
      });

      const fetchedAt = context.now();
      const content: RawContentRef = {
        ref,
        contentType: fixture.contentType,
        sourceUrl: request.url,
        contentHash: `hash:${fixtureId}`,
        capturedAt: fetchedAt,
      };

      return {
        ok: true,
        content,
        fetchedAt,
        sourceUrl: request.url,
      };
    },
  };

  return adapter;
}
