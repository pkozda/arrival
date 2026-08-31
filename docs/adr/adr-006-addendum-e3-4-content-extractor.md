---
id: adr-006-addendum-e3-4-content-extractor
title: ADR-006 Addendum — PDE E3.4 Production Content Extractor
project: Arrival Atlas
system: Arrival Atlas
status: accepted
maturity: evolving
owner: engineering
created: 2026-08-30
updated: 2026-08-30
related:
  - adr-006-personal-discovery-engine-boundaries
  - adr-006-addendum-e3-3-fetch-adapter
  - discovery-domain-index
---

# ADR-006 Addendum — PDE E3.4 Production Content Extractor

**Status:** Accepted (E3.4)  
**Date:** 2026-08-30  
**Parent:** [ADR-006](./adr-006-personal-discovery-engine-boundaries.md)  
**Package:** `@arrival-atlas/discovery`

---

## Decision

Implement the first production `ContentExtractor` as a **deterministic, offline HTML/text parser** over bodies already stored in `RawContentStore`.

Factory: `createProductionContentExtractor` / `createHtmlContentExtractor`.

## Parser choice

**`node-html-parser@9`** — lightweight DOM-like HTML parser with no browser, no JavaScript execution, and no network. Chosen because the monorepo had no existing HTML parser and regex-only extraction is too fragile for script/style exclusion, links, and JSON-LD.

## RawContentStore boundary

```text
RawContentRef → RawContentStore.get(ref) → parse → ExtractedFacts
```

Missing store entry → `PARSE_FAILED` (never successful empty extraction).

## Supported content types

`text/html`, `application/xhtml+xml`, `text/plain`.

## Structured data

JSON-LD (`application/ld+json`) may contribute flat hints (`title`, `organization`, `location`, `salary`, `employmentType`, `deadline`) when types such as JobPosting / Organization / Event / Offer appear.

Malformed JSON-LD blocks are skipped; HTML extraction continues.

## Resource limits (defaults)

| Limit | Default |
|-------|---------|
| maxRawBytes | 1_500_000 |
| maxVisibleTextChars | 20_000 |
| maxLinks | 50 |
| maxHeadings | 30 |
| maxJsonLdBlocks | 10 |

Truncation sets `extractionTruncated: true` rather than claiming completeness.

## Untrusted content

Page text never becomes instructions. Script/style/noscript removed before visible text. No network, no LLM, no Evidence, no Verification.

## Extraction ≠ Evidence ≠ Verification

`ExtractedFacts` are untrusted guesses. Salary present ≠ salary verified. Missing purchase language ≠ `purchaseRequired=false` (TriState UNKNOWN preserved via omission / `salary: null` when searched and absent).

## Why LLM / browser are deferred

LLM extraction is E2.4 AI Evaluate territory and must not fabricate evidence. Browser automation is deferred with E3.3 fetch (JS-rendered SPAs later).

## Known limitations

- Not website-specific scrapers
- Complex SPA DOM / shadow DOM unsupported
- Array-valued signals (`headings`, `links`, `structuredData`) stored as JSON strings inside `ExtractedFacts.fields` (primitive envelope)

---

## Related

- [E3.3 fetch adapter](./adr-006-addendum-e3-3-fetch-adapter.md)
- [Discovery README](../discovery/README.md)
