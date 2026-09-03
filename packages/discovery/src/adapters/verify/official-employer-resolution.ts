/**
 * E12.2 / E12.10 / E12.11 — Official employer URL discovery + attribution.
 *
 * Search provenance (AGGREGATOR) is not page authority. Aggregator pages may
 * contribute off-domain employer URLs (E12.2) but never self-qualify as OFFICIAL.
 * Employer-controlled discovery URLs may self-qualify only when hostname
 * authority matches the expected employer (E12.10) and E12.5 attribution holds.
 *
 * E12.11 — Conservative expected-employer resolution: JobPosting-scoped identity
 * with host alignment, then flat fields, then title∩host brand fallback.
 * Identity and host authority remain separate signals.
 */

import type { ExtractedFacts } from '../../types/candidate.js';

/** Hosts that are never accepted as the official employer page. */
const KNOWN_NON_EMPLOYER_HOSTS = [
  'linkedin.com',
  'indeed.com',
  'stepstone.de',
  'stepstone.com',
  'xing.com',
  'glassdoor.com',
  'glassdoor.de',
  'jooble.org',
  'bebee.com',
  'hirify.me',
  'unjobs.org',
  'workinaustria.com',
  'monster.com',
  'monster.de',
  'google.com',
  'bing.com',
  'brave.com',
  'duckduckgo.com',
  't.co',
  'bit.ly',
  'tinyurl.com',
] as const;

/** Hostname labels that must never become employer identity via title fallback. */
const GENERIC_HOST_LABELS = new Set([
  'www',
  'jobs',
  'job',
  'careers',
  'career',
  'apply',
  'work',
  'com',
  'de',
  'org',
  'net',
  'io',
  'co',
  'uk',
  'eu',
  'example',
]);

const APPLY_LINK_TEXT =
  /\b(apply|application|company (career|site|website)|official|karriere|bewerben|bewerbung|stellenausschreibung|view (job|opening)|company website|zur stelle|job (ad|posting|offer))\b/i;

const JOB_PATH =
  /\/(jobs?|careers?|stellenangebote?|stellen|vacancies|vacancy|position|positions|opening|openings|karriere)(\/|$)/i;

/** Path segments that mean an index/listing hub, not one vacancy (E12.14). */
const LISTING_PATH_SLUGS = new Set([
  'open-positions',
  'openpositions',
  'all-jobs',
  'alljobs',
  'job-search',
  'jobsearch',
  'search_jobs',
  'search-jobs',
  'search',
  'results',
  'index',
  'list',
  'listing',
  'listings',
  'overview',
  'opportunities',
  'vacancies',
  'positions',
  'openings',
  'jobs',
  'job',
  'careers',
  'career',
  'karriere',
  'stellenangebote',
  'stellen',
]);

const LISTING_BODY =
  /\b(open positions|all jobs|all openings|job search|search jobs|search our job|browse (all )?jobs|view all (openings|jobs|positions)|life at\b|students and early talent|early talent|contractor opportunit|getting hired|we['’]?re hiring across|explore (our )?careers|find your (next )?role)\b/i;

const VACANCY_CONTENT =
  /\b(apply now|bewerben|bewerbung|full-?time|part-?time|permanent|this (role|position|vacancy)|we are looking for|you['’]?ll (own|work|make)|responsibilities|requirements?|job type|employment type)\b/i;

const ROLE_TITLE_SIGNAL =
  /\b((senior|junior|staff|principal|lead)\s+)?((frontend|backend|full[-\s]?stack|software|platform|data|devops|security|product)\s+)?(engineer|developer|designer|manager|analyst|architect|scientist|specialist)\b/i;

export type EmployerLinkCandidate = {
  url: string;
  reason: string;
  priority: number;
};

export type EmployerAttributionInput = {
  expectedEmployer: string;
  pageUrl: string;
  pageBody: string;
  expectedTitle?: string;
};

export type EmployerAttributionResult =
  | { ok: true; detail: string }
  | { ok: false; detail: string };

export type ResolveExpectedEmployerOptions = {
  /** Discovery URL — used for host-aligned JobPosting selection and title∩host fallback. */
  discoveryUrl?: string;
};

/**
 * Select off-domain employer job URL candidates from extracted aggregator facts.
 * Conservative + deterministic. Never returns the discovery URL itself.
 */
export function selectOfficialEmployerCandidateUrls(input: {
  discoveryUrl?: string;
  extracted: ExtractedFacts;
  maxCandidates?: number;
}): EmployerLinkCandidate[] {
  const max = input.maxCandidates ?? 5;
  const discoveryHost = hostOf(input.discoveryUrl);
  const found = new Map<string, EmployerLinkCandidate>();

  const add = (rawUrl: string | null | undefined, reason: string, priority: number) => {
    const absolute = resolveAbsoluteUrl(rawUrl, input.discoveryUrl);
    if (!absolute) return;
    let parsed: URL;
    try {
      parsed = new URL(absolute);
    } catch {
      return;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return;
    if (parsed.username || parsed.password) return;
    const host = parsed.hostname.toLowerCase();
    if (!host || host === discoveryHost) return;
    if (isNonEmployerHost(host)) return;
    if (input.discoveryUrl && sameUrlIgnoringFragment(absolute, input.discoveryUrl)) {
      return;
    }
    const normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`;
    const existing = found.get(normalized);
    if (!existing || priority < existing.priority) {
      found.set(normalized, { url: normalized, reason, priority });
    }
  };

  const fields = input.extracted.fields;
  add(stringField(fields.jobPostingUrl), 'structured JobPosting.url', 10);
  add(stringField(fields.officialJobUrl), 'extracted officialJobUrl', 15);
  add(stringField(fields.hiringOrganizationUrl), 'hiringOrganization.url', 40);
  add(stringField(fields.canonicalUrl), 'canonicalUrl off-domain', 50);

  for (const link of parseLinks(fields.links)) {
    const textBoost = APPLY_LINK_TEXT.test(link.text) ? 0 : 20;
    const pathBoost = JOB_PATH.test(link.href) ? 0 : 15;
    add(link.href, `outbound link: ${link.text.slice(0, 80) || link.href}`, 30 + textBoost + pathBoost);
  }

  return [...found.values()]
    .sort((a, b) => a.priority - b.priority || a.url.localeCompare(b.url))
    .slice(0, max);
}

/**
 * Conservative employer attribution: expected company name must appear on the
 * fetched page (or as a hostname slug), and the page should look job-related.
 *
 * E12.5: job-like URL/path OR JobPosting JSON-LD (title overlap alone is insufficient).
 * E12.14: promoted Jobs results require individual-vacancy evidence — career/listing
 * indexes that only match JOB_PATH are rejected.
 */
export function employerAttributionMatches(
  input: EmployerAttributionInput
): EmployerAttributionResult {
  const expected = normalizeEmployerName(input.expectedEmployer);
  if (!expected || expected.length < 2) {
    return { ok: false, detail: 'Expected employer name missing or too short' };
  }

  const bodyLower = input.pageBody.toLowerCase();
  const host = hostOf(input.pageUrl) ?? '';

  const nameInBody = bodyLower.includes(expected);
  const nameInHost = employerNameMatchesHost(input.expectedEmployer, host);

  if (!nameInBody && !nameInHost) {
    return {
      ok: false,
      detail: `Employer "${input.expectedEmployer}" not found on page or host`,
    };
  }

  const jobPath = JOB_PATH.test(input.pageUrl);
  const hasJobPostingLd = /"@type"\s*:\s*"JobPosting"/i.test(input.pageBody);

  // E12.5: job-posting proof requires job-like URL/path OR JobPosting JSON-LD.
  // Title overlap alone is insufficient (marketing/events pages can match role tokens).
  if (!jobPath && !hasJobPostingLd) {
    return {
      ok: false,
      detail: 'Fetched page is not recognizably a job posting for this candidate',
    };
  }

  // E12.14: individual vacancy semantics (after authority + E12.5 gate).
  const vacancy = assessIndividualVacancyPage({
    pageUrl: input.pageUrl,
    pageBody: input.pageBody,
    expectedTitle: input.expectedTitle,
    hasJobPostingLd,
  });
  if (!vacancy.ok) {
    return vacancy;
  }

  return {
    ok: true,
    detail: nameInBody
      ? 'Employer name present on official page'
      : 'Employer name matches official host',
  };
}

/**
 * E12.14 — Conservative individual-vacancy gate.
 * Listing/index evidence fails closed even when JobPosting JSON-LD is present.
 * JobPosting JSON-LD is strong evidence only for non-listing pages.
 * Ambiguous pages without JobPosting fail closed.
 */
export function assessIndividualVacancyPage(input: {
  pageUrl: string;
  pageBody: string;
  expectedTitle?: string;
  hasJobPostingLd?: boolean;
}): EmployerAttributionResult {
  const hasJobPostingLd =
    input.hasJobPostingLd ?? /"@type"\s*:\s*"JobPosting"/i.test(input.pageBody);

  const title = (input.expectedTitle ?? '').trim();
  const combined = `${title}\n${input.pageBody}`;
  const listingPath = pathLooksLikeListingIndex(input.pageUrl);
  const specificPath = pathLooksLikeSpecificVacancy(input.pageUrl);
  const listingBody = LISTING_BODY.test(combined);
  const vacancyContent = VACANCY_CONTENT.test(combined);
  const roleSignal = ROLE_TITLE_SIGNAL.test(combined);

  // Listing/index evidence must not be overridden by JobPosting JSON-LD alone.
  if (listingPath && !(vacancyContent && roleSignal && specificPath)) {
    return {
      ok: false,
      detail: 'Page looks like a careers/open-positions listing, not an individual vacancy',
    };
  }

  if (listingBody && !specificPath && !(vacancyContent && roleSignal)) {
    return {
      ok: false,
      detail: 'Page looks like a careers/open-positions listing, not an individual vacancy',
    };
  }

  if (hasJobPostingLd) {
    return { ok: true, detail: 'JobPosting structured data present' };
  }

  if (specificPath && (vacancyContent || roleSignal)) {
    return { ok: true, detail: 'Vacancy-specific path with vacancy page content' };
  }

  if (vacancyContent && roleSignal && JOB_PATH.test(input.pageUrl)) {
    return { ok: true, detail: 'Vacancy content signals on job-related path' };
  }

  return {
    ok: false,
    detail: 'Insufficient evidence that the page is a single actionable vacancy',
  };
}

function pathLooksLikeListingIndex(pageUrl: string): boolean {
  let path: string;
  try {
    path = new URL(pageUrl).pathname.toLowerCase();
  } catch {
    return false;
  }
  const normalized = path.replace(/\/+$/, '') || '/';
  if (
    /^\/(jobs?|careers?|openings?|positions?|vacancies?|karriere|stellenangebote?|stellen)$/.test(
      normalized
    )
  ) {
    return true;
  }
  if (
    /\/(open-positions|all-jobs|job-search|search_jobs|search-jobs|jobs\/results)(\/|$)/.test(
      path
    )
  ) {
    return true;
  }
  return false;
}

function pathLooksLikeSpecificVacancy(pageUrl: string): boolean {
  let path: string;
  try {
    path = new URL(pageUrl).pathname.toLowerCase();
  } catch {
    return false;
  }
  const parts = path.split('/').filter(Boolean);
  const hubIdx = parts.findIndex((p) =>
    /^(jobs?|careers?|openings?|positions?|vacancies?|stellenangebote?|stellen|karriere)$/.test(
      p
    )
  );
  if (hubIdx < 0) return false;
  const after = parts
    .slice(hubIdx + 1)
    .filter((s) => !LISTING_PATH_SLUGS.has(s));
  if (after.length === 0) return false;
  // Role slug, ATS opaque id, or nested vacancy segment — not a bare listing hub.
  return after.some((s) => s.length >= 4);
}

export function resolveExpectedEmployer(
  extracted: ExtractedFacts,
  options?: ResolveExpectedEmployerOptions
): string | undefined {
  const discoveryUrl = options?.discoveryUrl;
  const host = hostOf(discoveryUrl);
  const title = stringField(extracted.fields.title);

  const fromJobPosting = resolveJobPostingEmployer(extracted, host);
  if (fromJobPosting) {
    return fromJobPosting;
  }

  for (const key of ['company', 'organization', 'employer', 'hiringOrganization'] as const) {
    const value = stringField(extracted.fields[key]);
    if (value) return value;
  }

  return resolveTitleHostBrandFallback({ host, title });
}

/**
 * JobPosting-scoped identity with host alignment (E12.11).
 *
 * Prefer host-aligned hiringOrganization; only then host-aligned identifier.name.
 * Never let identifier override a host-aligned hiringOrganization.
 * Never prefer bare @type:Organization over JobPosting context.
 */
function resolveJobPostingEmployer(
  extracted: ExtractedFacts,
  host: string | undefined
): string | undefined {
  const postings = collectJobPostings(extracted.fields.structuredData);
  if (postings.length === 0) {
    return undefined;
  }

  const hiringNames: string[] = [];
  const identifierNames: string[] = [];
  for (const posting of postings) {
    const hiring = nestedString(posting.hiringOrganization, 'name');
    if (hiring) hiringNames.push(hiring);
    const identifier = nestedString(posting.identifier, 'name');
    if (identifier) identifierNames.push(identifier);
  }

  if (host) {
    const hiringAligned = hiringNames.find((name) => employerNameMatchesHost(name, host));
    if (hiringAligned) return hiringAligned;
    const identifierAligned = identifierNames.find((name) =>
      employerNameMatchesHost(name, host)
    );
    if (identifierAligned) return identifierAligned;
  }

  // No host alignment available/matched — keep JobPosting hiringOrganization only
  // (identifier alone is not assumed to be the employer).
  return hiringNames[0];
}

/**
 * Title ∩ host brand fallback (E12.11). Never hostname alone.
 */
function resolveTitleHostBrandFallback(input: {
  host: string | undefined;
  title: string | undefined;
}): string | undefined {
  const { host, title } = input;
  if (!host || !title) return undefined;
  if (isNonEmployerHost(host)) return undefined;

  const brands = hostBrandLabels(host);
  const titleNorm = normalizeEmployerName(title);
  if (!titleNorm) return undefined;

  for (const brand of brands) {
    const brandNorm = normalizeEmployerName(brand);
    if (!brandNorm || brandNorm.length < 2) continue;
    if (!titleContainsBrand(titleNorm, brandNorm)) continue;
    return spellingFromTitle(title, brand) ?? capitalizeHostBrand(brand);
  }
  return undefined;
}

function titleContainsBrand(titleNorm: string, brandNorm: string): boolean {
  if (titleNorm.includes(brandNorm)) return true;
  const tokens = brandNorm.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((token) => token.length < 3 || titleNorm.includes(token));
}

function hostBrandLabels(hostname: string): string[] {
  const labels = hostname
    .toLowerCase()
    .split('.')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !GENERIC_HOST_LABELS.has(l));
  // Prefer full left-most brand segment (e.g. dresden-exists), then hyphen parts.
  const out: string[] = [];
  for (const label of labels) {
    out.push(label);
    if (label.includes('-')) {
      for (const part of label.split('-')) {
        if (part && !GENERIC_HOST_LABELS.has(part) && part.length >= 2) {
          out.push(part);
        }
      }
    }
  }
  return out;
}

function spellingFromTitle(title: string, brand: string): string | undefined {
  const brandNorm = normalizeEmployerName(brand);
  // Match brand allowing | _ - space separators between tokens
  const tokens = brandNorm.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return undefined;
  const pattern = tokens
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\s|_\\-·–—]*');
  const re = new RegExp(pattern, 'i');
  const m = title.match(re);
  return m?.[0]?.trim() || undefined;
}

function capitalizeHostBrand(brand: string): string {
  if (!brand) return brand;
  if (brand.includes('-')) {
    return brand
      .split('-')
      .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p))
      .join('-');
  }
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

function collectJobPostings(structuredDataField: unknown): Array<Record<string, unknown>> {
  const raw = stringField(structuredDataField);
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const out: Array<Record<string, unknown>> = [];
  const visit = (node: unknown): void => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if (Array.isArray(obj['@graph'])) {
      visit(obj['@graph']);
    }
    const types = normalizeJsonLdTypes(obj['@type']);
    if (types.has('JobPosting')) {
      out.push(obj);
    }
  };
  visit(parsed);
  return out;
}

function normalizeJsonLdTypes(value: unknown): Set<string> {
  const set = new Set<string>();
  if (typeof value === 'string') set.add(value);
  if (Array.isArray(value)) {
    for (const v of value) {
      if (typeof v === 'string') set.add(v);
    }
  }
  return set;
}

function nestedString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return stringField((value as Record<string, unknown>)[key]);
}

export function isNonEmployerHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  for (const known of KNOWN_NON_EMPLOYER_HOSTS) {
    if (h === known || h.endsWith(`.${known}`)) return true;
  }
  return false;
}

/**
 * True when the normalized employer name appears in the hostname (slug or tokens).
 * Reused by attribution and E12.10 direct-discovery host authority.
 */
export function employerNameMatchesHost(
  expectedEmployer: string,
  hostname: string
): boolean {
  const expected = normalizeEmployerName(expectedEmployer);
  if (!expected || expected.length < 2) return false;
  const host = hostname.toLowerCase();
  if (!host) return false;
  const hostSlug = host.replace(/\./g, ' ');
  return (
    host.includes(expected.replace(/\s+/g, '')) ||
    hostSlug.includes(expected) ||
    expected.split(/\s+/).every((token) => token.length < 3 || host.includes(token))
  );
}

/**
 * E12.10 — Discovery URL may be treated as employer-controlled only when:
 * - host is not a known non-employer / aggregator host, and
 * - expected employer name matches the discovery hostname.
 *
 * Body mention alone is intentionally insufficient (aggregator pages mention employers).
 */
export function isEmployerControlledDiscoveryHost(input: {
  discoveryUrl: string;
  expectedEmployer: string;
}): boolean {
  const host = hostOf(input.discoveryUrl);
  if (!host || isNonEmployerHost(host)) {
    return false;
  }
  return employerNameMatchesHost(input.expectedEmployer, host);
}

export function normalizeEmployerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(gmbh|ag|ltd|llc|inc|co\.?|company|se|kg|ug|mbh)\b/gi, ' ')
    .replace(/[^a-z0-9äöüß\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stringField(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return undefined;
}

function hostOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function resolveAbsoluteUrl(
  raw: string | null | undefined,
  base?: string
): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  const trimmed = raw.trim();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('mailto:') || trimmed.startsWith('#')) {
    return undefined;
  }
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return undefined;
  }
}

function sameUrlIgnoringFragment(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    ua.hash = '';
    ub.hash = '';
    return ua.toString() === ub.toString();
  } catch {
    return a === b;
  }
}

function parseLinks(
  linksField: unknown
): Array<{ href: string; text: string }> {
  if (typeof linksField !== 'string' || !linksField.trim()) return [];
  try {
    const parsed = JSON.parse(linksField) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: Array<{ href: string; text: string }> = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const href = (item as { href?: unknown }).href;
      const text = (item as { text?: unknown }).text;
      if (typeof href === 'string' && href.trim()) {
        out.push({
          href: href.trim(),
          text: typeof text === 'string' ? text : '',
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}
