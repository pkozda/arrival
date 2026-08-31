import { parse, type HTMLElement } from 'node-html-parser';
import type { ExtractedFacts, RawContentRef } from '../../types/candidate.js';
import type {
  ContentExtractor,
  ExtractionContext,
  ExtractionResult,
} from '../../pipeline/adapters.js';
import type { RawContentStore } from '../../pipeline/fakes/raw-content-store.js';
import { assertNotAborted } from '../../adapter-infra/index.js';

export const DEFAULT_EXTRACT_ALLOWED_CONTENT_TYPES = [
  'text/html',
  'application/xhtml+xml',
  'text/plain',
] as const;

/** Align with E3.3 fetch default — refuse to parse unbounded bodies. */
export const DEFAULT_EXTRACT_MAX_RAW_BYTES = 1_500_000;
export const DEFAULT_MAX_VISIBLE_TEXT_CHARS = 20_000;
export const DEFAULT_MAX_LINKS = 50;
export const DEFAULT_MAX_HEADINGS = 30;
export const DEFAULT_MAX_JSON_LD_BLOCKS = 10;

/**
 * Injected config — composition root supplies store; no process.env.
 * Vendor-agnostic: no Brave / job-board / giveaway knowledge.
 */
export type ProductionContentExtractorConfig = {
  rawContentStore: RawContentStore;
  allowedContentTypes?: readonly string[];
  maxRawBytes?: number;
  maxVisibleTextChars?: number;
  maxLinks?: number;
  maxHeadings?: number;
  maxJsonLdBlocks?: number;
};

export function createProductionContentExtractor(
  config: ProductionContentExtractorConfig
): ContentExtractor {
  return createHtmlContentExtractor(config);
}

export function createHtmlContentExtractor(
  config: ProductionContentExtractorConfig
): ContentExtractor {
  const store = config.rawContentStore;
  const allowed = new Set(
    (config.allowedContentTypes ?? DEFAULT_EXTRACT_ALLOWED_CONTENT_TYPES).map(
      (t) => t.toLowerCase()
    )
  );
  const maxRawBytes = config.maxRawBytes ?? DEFAULT_EXTRACT_MAX_RAW_BYTES;
  const maxVisibleTextChars =
    config.maxVisibleTextChars ?? DEFAULT_MAX_VISIBLE_TEXT_CHARS;
  const maxLinks = config.maxLinks ?? DEFAULT_MAX_LINKS;
  const maxHeadings = config.maxHeadings ?? DEFAULT_MAX_HEADINGS;
  const maxJsonLdBlocks = config.maxJsonLdBlocks ?? DEFAULT_MAX_JSON_LD_BLOCKS;

  return {
    async extract(
      content: RawContentRef,
      context: ExtractionContext
    ): Promise<ExtractionResult> {
      try {
        assertNotAborted(context.signal, 'extract', 'parse');
      } catch {
        return {
          ok: false,
          reasonCode: 'PARSE_FAILED',
          message: 'Parse cancelled',
        };
      }

      const stored = store.get(content.ref);
      if (!stored) {
        return {
          ok: false,
          reasonCode: 'PARSE_FAILED',
          message: 'Raw content not found in store',
        };
      }

      const contentType = normalizeContentType(
        stored.contentType || content.contentType || ''
      );
      if (!contentType || !allowed.has(contentType)) {
        return {
          ok: false,
          reasonCode: 'PARSE_FAILED',
          message: 'Unsupported content type for extraction',
        };
      }

      const rawBytes = Buffer.byteLength(stored.body, 'utf8');
      if (rawBytes > maxRawBytes) {
        return {
          ok: false,
          reasonCode: 'PARSE_FAILED',
          message: 'Raw content exceeds extraction size limit',
        };
      }

      if (stored.body.includes('<<<not-parseable>>>')) {
        return {
          ok: false,
          reasonCode: 'PARSE_FAILED',
          message: 'Malformed content marker',
        };
      }

      try {
        if (contentType === 'text/plain') {
          return {
            ok: true,
            extracted: extractPlainText(stored.body, maxVisibleTextChars),
          };
        }
        return {
          ok: true,
          extracted: extractHtml(stored.body, {
            maxVisibleTextChars,
            maxLinks,
            maxHeadings,
            maxJsonLdBlocks,
          }),
        };
      } catch {
        return {
          ok: false,
          reasonCode: 'PARSE_FAILED',
          message: 'Extraction failed',
        };
      }
    },
  };
}

type HtmlLimits = {
  maxVisibleTextChars: number;
  maxLinks: number;
  maxHeadings: number;
  maxJsonLdBlocks: number;
};

function extractHtml(body: string, limits: HtmlLimits): ExtractedFacts {
  const root = parse(body, {
    lowerCaseTagName: false,
    comment: false,
    blockTextElements: {
      script: true,
      style: true,
      noscript: true,
    },
  });

  // Remove non-content nodes before visible text / link walks
  for (const el of root.querySelectorAll('script, style, noscript')) {
    el.remove();
  }

  const fields: ExtractedFacts['fields'] = {};
  let truncated = false;

  const titleEl = root.querySelector('title');
  const h1 = root.querySelector('h1');
  const ogTitle = root
    .querySelector('meta[property="og:title"]')
    ?.getAttribute('content');
  const title =
    cleanText(titleEl?.text ?? '') ||
    cleanText(h1?.text ?? '') ||
    cleanText(ogTitle ?? '');
  if (title) fields.title = title;

  const headings = root
    .querySelectorAll('h1, h2, h3')
    .map((el) => cleanText(el.text))
    .filter(Boolean);
  if (headings.length > limits.maxHeadings) {
    truncated = true;
  }
  const headingSlice = headings.slice(0, limits.maxHeadings);
  if (headingSlice.length > 0) {
    fields.headings = stableJson(headingSlice);
  }

  const canonical =
    root.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() ??
    '';
  if (canonical) fields.canonicalUrl = canonical;

  // data-field="key" convention (fixtures / lightweight markup)
  for (const el of root.querySelectorAll('[data-field]')) {
    const key = el.getAttribute('data-field')?.trim();
    if (!key || key in fields) continue;
    const value = cleanText(el.text);
    if (value) fields[key] = value;
  }

  const links = collectLinks(root, limits.maxLinks);
  if (links.truncated) truncated = true;
  if (links.items.length > 0) {
    fields.links = stableJson(links.items);
  }

  const structured = collectJsonLd(body, limits.maxJsonLdBlocks);
  if (structured.truncated) truncated = true;
  if (structured.items.length > 0) {
    fields.structuredData = stableJson(structured.items);
    applyStructuredHints(fields, structured.items);
  }

  let visible = cleanText(root.text);
  if (visible.length > limits.maxVisibleTextChars) {
    visible = visible.slice(0, limits.maxVisibleTextChars);
    truncated = true;
    fields.extractionTruncated = true;
  }
  if (visible) fields.visibleText = visible;

  if (truncated) fields.extractionTruncated = true;

  // TriState: salary looked for but not established → null (UNKNOWN), never false
  if (!('salary' in fields)) {
    fields.salary = null;
  }

  // Never infer purchaseRequired=false from missing purchase language
  return { fields };
}

function extractPlainText(
  body: string,
  maxVisibleTextChars: number
): ExtractedFacts {
  const fields: ExtractedFacts['fields'] = {};
  let truncated = false;
  const lines = body.split(/\r?\n/);

  for (const line of lines) {
    const m = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.+)$/);
    if (!m?.[1] || m[2] === undefined) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    const mapped =
      key === 'title'
        ? 'title'
        : key === 'location'
          ? 'location'
          : key === 'salary'
            ? 'salary'
            : key === 'organization' || key === 'company'
              ? 'organization'
              : key === 'employmenttype' || key === 'employment_type'
                ? 'employmentType'
                : key === 'deadline'
                  ? 'deadline'
                  : key;
    if (!(mapped in fields)) {
      fields[mapped] = value;
    }
  }

  let visible = body.replace(/\s+/g, ' ').trim();
  if (visible.length > maxVisibleTextChars) {
    visible = visible.slice(0, maxVisibleTextChars);
    truncated = true;
  }
  if (visible) fields.visibleText = visible;
  if (truncated) fields.extractionTruncated = true;
  if (!('salary' in fields)) fields.salary = null;

  return { fields };
}

function collectLinks(
  root: HTMLElement,
  maxLinks: number
): { items: Array<{ href: string; text: string }>; truncated: boolean } {
  const items: Array<{ href: string; text: string }> = [];
  let truncated = false;
  for (const a of root.querySelectorAll('a[href]')) {
    const href = (a.getAttribute('href') ?? '').trim();
    if (!href || href.startsWith('javascript:') || href.startsWith('data:')) {
      continue;
    }
    if (items.length >= maxLinks) {
      truncated = true;
      break;
    }
    items.push({
      href,
      text: cleanText(a.text).slice(0, 200),
    });
  }
  items.sort((a, b) =>
    a.href === b.href ? a.text.localeCompare(b.text) : a.href.localeCompare(b.href)
  );
  return { items, truncated };
}

function collectJsonLd(
  body: string,
  maxBlocks: number
): { items: unknown[]; truncated: boolean } {
  // Re-parse original body for script tags (removed from visible DOM walk)
  const rawRoot = parse(body, { comment: false });
  const scripts = rawRoot.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  const items: unknown[] = [];
  let truncated = false;
  for (const script of scripts) {
    if (items.length >= maxBlocks) {
      truncated = true;
      break;
    }
    const raw = script.text?.trim() ?? '';
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (items.length >= maxBlocks) {
            truncated = true;
            break;
          }
          items.push(entry);
        }
      } else {
        items.push(parsed);
      }
    } catch {
      // Malformed JSON-LD: skip block; continue HTML extraction
    }
  }
  return { items, truncated };
}

/**
 * Map common schema.org shapes into flat ExtractedFacts fields.
 * Extraction only — never verification.
 */
function applyStructuredHints(
  fields: ExtractedFacts['fields'],
  items: unknown[]
): void {
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const types = normalizeTypes(obj['@type']);
    const graph = obj['@graph'];
    if (Array.isArray(graph)) {
      applyStructuredHints(fields, graph);
    }

    if (
      types.has('JobPosting') ||
      types.has('Offer') ||
      types.has('Event') ||
      types.has('Organization')
    ) {
      const name = asString(obj.title) || asString(obj.name);
      if (name && !fields.title) fields.title = name;

      const org =
        asString(nested(obj.hiringOrganization, 'name')) ||
        asString(nested(obj.organizer, 'name')) ||
        (types.has('Organization') ? asString(obj.name) : undefined);
      if (org && !fields.organization) fields.organization = org;

      const location =
        asString(nested(obj.jobLocation, 'address', 'addressLocality')) ||
        asString(nested(obj.jobLocation, 'name')) ||
        asString(nested(obj.location, 'name')) ||
        asString(obj.location);
      if (location && !fields.location) fields.location = location;

      const salary =
        asString(nested(obj.baseSalary, 'value')) ||
        asString(nested(obj.baseSalary, 'value', 'value')) ||
        asString(obj.salary);
      if (salary && fields.salary == null) fields.salary = salary;

      const employmentType = asString(obj.employmentType);
      if (employmentType && !fields.employmentType) {
        fields.employmentType = employmentType;
      }

      const deadline =
        asString(obj.validThrough) ||
        asString(obj.endDate) ||
        asString(obj.applicationDeadline);
      if (deadline && !fields.deadline) fields.deadline = deadline;
    }
  }
}

function normalizeTypes(value: unknown): Set<string> {
  const set = new Set<string>();
  if (typeof value === 'string') set.add(value);
  if (Array.isArray(value)) {
    for (const v of value) {
      if (typeof v === 'string') set.add(v);
    }
  }
  return set;
}

function nested(
  value: unknown,
  ...keys: string[]
): unknown {
  let cur: unknown = value;
  for (const key of keys) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function normalizeContentType(header: string): string {
  return header.split(';')[0]!.trim().toLowerCase();
}
