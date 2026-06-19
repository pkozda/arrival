---
id: index-schema
title: Documentation Index Schema
project: Arrival Atlas
system: Arrival Atlas
type: system
domain: platform
status: active
maturity: stable
owner: system
tags:
  - documentation-system
  - rag-index
  - search-schema
created: 2026-06-19
updated: 2026-06-19
related:
  - taxonomy
---

# Documentation Index Schema (RAG-ready)

This schema defines how Arrival Atlas documentation is indexed for search, agent retrieval, and future RAG pipelines.

## Index record shape

Each indexed document produces one JSON record:

```json
{
  "id": "profile-ux-spec",
  "title": "Profile UX Design Specification",
  "path": "docs/identity/profile-ux-spec.md",
  "type": "ux",
  "domain": "identity",
  "status": "active",
  "maturity": "stable",
  "tags": ["profile-mirror", "onboarding-ux", "situation-summary"],
  "created": "2026-06-01",
  "updated": "2026-06-19",
  "related": ["profile-ux-discovery", "profile-system-v1-roadmap"],
  "summary": "First paragraph or H1 context after frontmatter",
  "headings": ["Overview", "Information Architecture", "..."],
  "body_text": "Plain text content without frontmatter",
  "chunk_ids": ["profile-ux-spec#h2-ia", "..."]
}
```

## Chunking strategy

| Level | Split on | Max tokens | Use for |
|-------|----------|------------|---------|
| **Document** | Full file | — | Metadata lookup, doc listing |
| **Section** | `##` headings | 800 | Primary RAG retrieval unit |
| **Subsection** | `###` headings | 400 | Fine-grained Q&A |

Each chunk inherits parent metadata plus:

```json
{
  "chunk_id": "{doc-id}#{heading-slug}",
  "heading_path": ["Profile UX Design Specification", "Information Architecture"],
  "anchor": "#information-architecture"
}
```

## Filter dimensions (query API)

Agents and search UIs should filter on:

- `domain` — narrow to identity, benefits, platform, etc.
- `type` — audits vs specs vs roadmaps
- `status` — exclude `archived` by default
- `maturity` — prefer `stable` for production decisions
- `tags` — semantic intersection (AND within group, OR across groups)

### Example queries

| Intent | Filters |
|--------|---------|
| Profile UX decisions | `domain=identity`, `type in [ux, research]` |
| Active platform gates | `domain=platform`, `type=audit`, `status=active` |
| Benefits implementation | `tags contains benefits-calculation`, `status=active` |

## Retrieval ranking signals

1. **Status** — `active` > `draft` > `deprecated` > `archived`
2. **Maturity** — `stable` > `evolving` > `experimental`
3. **Recency** — `updated` date descending
4. **Graph proximity** — boost docs linked in `related` of the hit doc
5. **Domain match** — boost when query domain matches `domain` field

## Index output

Run `python3 docs/meta/index-docs.py` to generate:

- `docs/meta/docs-index.json` — full document index
- `docs/meta/docs-chunks.jsonl` — section-level chunks for embedding

## Integration points

| Consumer | Entry |
|----------|-------|
| Cursor agents | Read `docs-index.json` for doc discovery |
| RAG pipeline | Embed `docs-chunks.jsonl` sections |
| CI validation | Assert all `.md` files have valid frontmatter |
| Link checker | Resolve `related` IDs against index |
