#!/usr/bin/env python3
"""Rebrand ArrivalOS → Arrival Atlas across repository."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

SKIP_DIRS = {".git", "node_modules", ".next", "dist", "coverage"}
SKIP_FILES = {"rebrand.py", "migrate-docs.py"}

# Order matters: longer / more specific patterns first.
REPLACEMENTS = [
    ("Arrival Atlas (ArrivalOS)", "Arrival Atlas"),
    ("Arrival Atlas (Arrival OS)", "Arrival Atlas"),
    ("Arrive Atlas", "Arrival Atlas"),
    ("Arrival OS", "Arrival Atlas"),
    ("ArrivalOS", "Arrival Atlas"),
    ("ARRIVALOS_", "ARRIVAL_ATLAS_"),
    ("@arrivalos/", "@arrival-atlas/"),
    ("@arrivalos", "@arrival-atlas"),
    (".arrivalos-", ".arrival-atlas-"),
    ("arrivalos-theme", "arrival-atlas-theme"),
    ("arrivalos-api", "arrival-atlas-api"),
    ("arrivalos-state-test-", "arrival-atlas-state-test-"),
    ("arrivalos-state-fallback", "arrival-atlas-state-fallback"),
    ('name": "arrivalos"', 'name": "arrival-atlas"'),
    ("ArrivalOS/", "arrival-atlas/"),
]

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)


def parse_fm(raw: str) -> tuple[dict, list[str]]:
    lines = raw.splitlines()
    meta: dict = {}
    order: list[str] = []
    list_key: str | None = None
    for line in lines:
        if line.startswith("  - "):
            if list_key:
                meta.setdefault(list_key, []).append(line[4:].strip())
            continue
        if ":" not in line:
            continue
        key, val = line.split(":", 1)
        key, val = key.strip(), val.strip()
        if key not in meta:
            order.append(key)
        if val == "":
            list_key = key
            meta[key] = []
        elif val == "[]":
            list_key = None
            meta[key] = []
        else:
            list_key = None
            meta[key] = val
    return meta, order


def render_fm(meta: dict, order: list[str]) -> str:
    lines = ["---"]
    seen = set()
    for key in order:
        if key in meta:
            seen.add(key)
            val = meta[key]
            if isinstance(val, list):
                lines.append(f"{key}:")
                for item in val:
                    lines.append(f"  - {item}")
            else:
                lines.append(f"{key}: {val}")
    for key, val in meta.items():
        if key in seen:
            continue
        if isinstance(val, list):
            lines.append(f"{key}:")
            for item in val:
                lines.append(f"  - {item}")
        else:
            lines.append(f"{key}: {val}")
    lines.append("---")
    return "\n".join(lines) + "\n"


def add_project_system_fm(text: str) -> str:
    m = FRONTMATTER_RE.match(text)
    if not m:
        return text
    meta, order = parse_fm(m.group(1))
    changed = False
    if "project" not in meta:
        meta["project"] = "Arrival Atlas"
        order.insert(order.index("title") + 1 if "title" in order else 0, "project")
        changed = True
    if "system" not in meta:
        meta["system"] = "Arrival Atlas"
        idx = order.index("project") + 1 if "project" in order else len(order)
        order.insert(idx, "system")
        changed = True
    if not changed:
        return text
    body = text[m.end() :]
    return render_fm(meta, order) + body


def should_process(path: Path) -> bool:
    if any(part in SKIP_DIRS for part in path.parts):
        return False
    if path.name in SKIP_FILES:
        return False
    if path.suffix in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2"}:
        return False
    return True


def apply_replacements(text: str) -> str:
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    return text


def main() -> None:
    changed_files: list[str] = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or not should_process(path):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, PermissionError):
            continue
        original = text
        text = apply_replacements(text)
        if path.suffix == ".md" and path.is_relative_to(ROOT / "docs"):
            text = add_project_system_fm(text)
        if text != original:
            path.write_text(text, encoding="utf-8")
            changed_files.append(str(path.relative_to(ROOT)))
    print(f"Updated {len(changed_files)} files.")
    for f in changed_files[:60]:
        print(f"  {f}")
    if len(changed_files) > 60:
        print(f"  ... and {len(changed_files) - 60} more")


if __name__ == "__main__":
    main()
