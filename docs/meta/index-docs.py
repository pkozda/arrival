#!/usr/bin/env python3
"""Build searchable JSON index from docs/ frontmatter."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"
META = DOCS / "meta"
FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
HEADING_RE = re.compile(r"^(#{1,3})\s+(.+)$", re.MULTILINE)


def parse_frontmatter(raw: str) -> dict:
    meta: dict = {}
    for line in raw.splitlines():
        if line.startswith("  - "):
            key = meta.pop("_list_key", None)
            if key:
                meta.setdefault(key, []).append(line[4:].strip())
            continue
        if ":" not in line:
            continue
        key, val = line.split(":", 1)
        key, val = key.strip(), val.strip()
        if val == "":
            meta["_list_key"] = key
            meta[key] = []
        elif val == "[]":
            meta[key] = []
        else:
            meta[key] = val
    meta.pop("_list_key", None)
    return meta


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def parse_doc(path: Path) -> dict | None:
    text = path.read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(text)
    if not m:
        return None
    meta = parse_frontmatter(m.group(1))
    body = text[m.end() :]
    headings = [h.group(2).strip() for h in HEADING_RE.finditer(body)]
    summary = ""
    for line in body.splitlines():
        line = line.strip()
        if line and not line.startswith("#") and not line.startswith("---"):
            summary = line[:300]
            break
    rel = str(path.relative_to(ROOT))
    doc_id = meta.get("id") or slugify(path.stem)
    record = {
        "id": doc_id,
        "title": meta.get("title", path.stem),
        "path": rel,
        "type": meta.get("type"),
        "domain": meta.get("domain"),
        "status": meta.get("status", "active"),
        "maturity": meta.get("maturity", "stable"),
        "tags": meta.get("tags", []),
        "created": meta.get("created"),
        "updated": meta.get("updated"),
        "related": meta.get("related", []),
        "summary": summary,
        "headings": headings,
    }
    return record


def chunk_doc(path: Path, record: dict) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    body = FRONTMATTER_RE.sub("", text, count=1)
    chunks: list[dict] = []
    sections = re.split(r"(?=^## )", body, flags=re.MULTILINE)
    for section in sections:
        section = section.strip()
        if not section or section.startswith("# ") and not section.startswith("## "):
            continue
        hm = re.match(r"^##\s+(.+)", section)
        if not hm:
            continue
        heading = hm.group(1).strip()
        chunk_id = f"{record['id']}#{slugify(heading)}"
        chunks.append(
            {
                "chunk_id": chunk_id,
                "doc_id": record["id"],
                "path": record["path"],
                "heading": heading,
                "domain": record["domain"],
                "type": record["type"],
                "tags": record["tags"],
                "text": section[:4000],
            }
        )
    return chunks


def main() -> None:
    records: list[dict] = []
    chunks: list[dict] = []
    missing_fm: list[str] = []

    for path in sorted(DOCS.rglob("*.md")):
        if path.name.startswith("."):
            continue
        rec = parse_doc(path)
        if rec is None:
            missing_fm.append(str(path.relative_to(ROOT)))
            continue
        records.append(rec)
        chunks.extend(chunk_doc(path, rec))

    META.mkdir(parents=True, exist_ok=True)
    (META / "docs-index.json").write_text(
        json.dumps({"documents": records, "count": len(records)}, indent=2),
        encoding="utf-8",
    )
    with (META / "docs-chunks.jsonl").open("w", encoding="utf-8") as f:
        for chunk in chunks:
            f.write(json.dumps(chunk) + "\n")

    print(f"Indexed {len(records)} documents, {len(chunks)} chunks.")
    if missing_fm:
        print(f"WARNING: {len(missing_fm)} files missing frontmatter:")
        for p in missing_fm:
            print(f"  - {p}")


if __name__ == "__main__":
    main()
