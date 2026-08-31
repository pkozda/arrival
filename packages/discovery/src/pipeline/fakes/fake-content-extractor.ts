import type { ExtractedFacts, RawContentRef } from '../../types/candidate.js';
import type {
  ContentExtractor,
  ExtractionContext,
  ExtractionResult,
} from '../adapters.js';
import type { RawContentStore } from './raw-content-store.js';

export type FakeContentExtractorOptions = {
  contentStore: RawContentStore;
  /** Candidate ids that force parse failure */
  failCandidateIds?: string[];
  /** Raw refs that force parse failure */
  failRefs?: string[];
};

/**
 * Deterministic ContentExtractor — no AI, no network.
 * Parses anonymized HTML/text fixtures into ExtractedFacts.
 * Missing fields stay absent/null — never coerced to 0/false.
 */
export function createFakeContentExtractor(
  options: FakeContentExtractorOptions
): ContentExtractor {
  return {
    async extract(
      content: RawContentRef,
      context: ExtractionContext
    ): Promise<ExtractionResult> {
      if (options.failCandidateIds?.includes(context.candidateId)) {
        return {
          ok: false,
          reasonCode: 'PARSE_FAILED',
          message: `Simulated parse failure for ${context.candidateId}`,
        };
      }
      if (options.failRefs?.includes(content.ref)) {
        return {
          ok: false,
          reasonCode: 'PARSE_FAILED',
          message: `Simulated parse failure for ref ${content.ref}`,
        };
      }

      const stored = options.contentStore.get(content.ref);
      if (!stored) {
        return {
          ok: false,
          reasonCode: 'PARSE_FAILED',
          message: `Raw content not found for ref ${content.ref}`,
        };
      }

      if (stored.body.includes('<<<not-parseable>>>')) {
        return {
          ok: false,
          reasonCode: 'PARSE_FAILED',
          message: 'Malformed content',
        };
      }

      const extracted = parseFixtureBody(stored.body, stored.contentType);
      return { ok: true, extracted };
    },
  };
}

function parseFixtureBody(body: string, contentType: string): ExtractedFacts {
  const fields: ExtractedFacts['fields'] = {};

  if (contentType.includes('html') || body.includes('<')) {
    const titleMatch = body.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (titleMatch?.[1]) {
      fields.title = titleMatch[1].trim();
    }
    for (const match of body.matchAll(
      /data-field="([^"]+)"[^>]*>([^<]+)</gi
    )) {
      const key = match[1];
      const value = match[2]?.trim();
      if (key && value !== undefined) {
        fields[key] = value;
      }
    }
    // Explicit UNKNOWN: salary absent → null (never 0)
    if (!('salary' in fields)) {
      fields.salary = null;
    }
    return { fields };
  }

  // text/plain key: value lines
  for (const line of body.split('\n')) {
    const m = line.match(/^([A-Za-z]+):\s*(.+)$/);
    if (m?.[1] && m[2]) {
      const key = m[1].toLowerCase();
      fields[key === 'title' ? 'title' : key] = m[2].trim();
    }
  }
  if (!('salary' in fields)) {
    fields.salary = null;
  }
  return { fields };
}
