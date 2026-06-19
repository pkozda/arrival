#!/usr/bin/env python3
"""Bulk-update doc path references after domain IA migration."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Order matters: longer/more specific patterns first.
REPLACEMENTS = [
    ("docs/product/current-state.md", "docs/core/current-state.md"),
    ("docs/product/profile-ux-spec.md", "docs/identity/profile-ux-spec.md"),
    ("docs/product/benefits-simulator-design.md", "docs/benefits/benefits-simulator-design.md"),
    ("docs/specs/module-versioning-policy.md", "docs/platform/module-versioning-policy.md"),
    ("docs/specs/module-runtime-contract-v1.md", "docs/core/module-runtime-contract-v1.md"),
    ("docs/specs/mrc-adl.md", "docs/core/mrc-adl.md"),
    ("docs/architecture/user-profile-engine-design.md", "docs/identity/user-profile-engine-design.md"),
    ("docs/architecture/financial-module-v2-notes.md", "docs/finance/financial-module-v2-notes.md"),
    ("docs/architecture/mrc-4-action-framework-blueprint.md", "docs/platform/mrc-4-action-framework-blueprint.md"),
    ("docs/architecture/iam-phase-3-1-boundary-stabilization.md", "docs/platform/iam-phase-3-1-boundary-stabilization.md"),
    ("docs/architecture/iam-evolution-roadmap.md", "docs/platform/iam-evolution-roadmap.md"),
    ("docs/architecture/module-runtime-evolution-roadmap.md", "docs/archive/module-runtime-evolution-roadmap.md"),
    ("docs/roadmap/mrc-6-to-platform.md", "docs/platform/mrc-6-to-platform-roadmap.md"),
    ("docs/roadmap/iam-evolution.md", "docs/platform/iam-evolution-roadmap.md"),
    ("docs/roadmap/profile-system-v1.md", "docs/identity/profile-system-v1-roadmap.md"),
    ("docs/roadmap/financial-module-v2-plan.md", "docs/finance/financial-module-v2-plan.md"),
    ("docs/roadmap/benefits-simulator-implementation-plan.md", "docs/benefits/benefits-simulator-implementation-plan.md"),
    ("docs/research/profile-ux-discovery.md", "docs/identity/profile-ux-discovery.md"),
    ("docs/research/roadmap-vs-current-state.md", "docs/platform/roadmap-vs-current-state.md"),
    ("docs/research/payroll-library-evaluation.md", "docs/finance/payroll-library-evaluation.md"),
    ("docs/contracts/benefits-simulator-ui-contract.md", "docs/benefits/benefits-simulator-ui-contract.md"),
    ("docs/adr/", "docs/decisions/"),
    ("../architecture/user-profile-engine-design.md", "../identity/user-profile-engine-design.md"),
    ("../architecture/financial-module-v2-notes.md", "../finance/financial-module-v2-notes.md"),
    ("../architecture/mrc-4-action-framework-blueprint.md", "../platform/mrc-4-action-framework-blueprint.md"),
    ("../architecture/iam-phase-3-1-boundary-stabilization.md", "../platform/iam-phase-3-1-boundary-stabilization.md"),
    ("../architecture/iam-evolution-roadmap.md", "../platform/iam-evolution-roadmap.md"),
    ("../architecture/module-runtime-evolution-roadmap.md", "../archive/module-runtime-evolution-roadmap.md"),
    ("../roadmap/mrc-6-to-platform.md", "../platform/mrc-6-to-platform-roadmap.md"),
    ("../roadmap/iam-evolution.md", "../platform/iam-evolution-roadmap.md"),
    ("../roadmap/profile-system-v1.md", "../identity/profile-system-v1-roadmap.md"),
    ("../roadmap/financial-module-v2-plan.md", "../finance/financial-module-v2-plan.md"),
    ("../roadmap/benefits-simulator-implementation-plan.md", "../benefits/benefits-simulator-implementation-plan.md"),
    ("../research/profile-ux-discovery.md", "../identity/profile-ux-discovery.md"),
    ("../research/roadmap-vs-current-state.md", "../platform/roadmap-vs-current-state.md"),
    ("../research/payroll-library-evaluation.md", "../finance/payroll-library-evaluation.md"),
    ("../specs/module-versioning-policy.md", "../platform/module-versioning-policy.md"),
    ("../specs/module-runtime-contract-v1.md", "../core/module-runtime-contract-v1.md"),
    ("../specs/mrc-adl.md", "../core/mrc-adl.md"),
    ("../contracts/benefits-simulator-ui-contract.md", "../benefits/benefits-simulator-ui-contract.md"),
    ("../product/current-state.md", "../core/current-state.md"),
    ("../product/benefits-simulator-design.md", "../benefits/benefits-simulator-design.md"),
    ("../product/profile-ux-spec.md", "../identity/profile-ux-spec.md"),
    ("../audits/../audits/", "../audits/"),
    ("[../specs/](../specs/)", "[../core/](../core/) and [../platform/](../platform/)"),
    ("docs/architecture/", "docs/identity/ or docs/platform/ or docs/finance/"),
    ("docs/roadmap/", "docs/platform/ or docs/identity/ or docs/benefits/ or docs/finance/"),
]


def main() -> None:
    changed = 0
    for path in ROOT.rglob("*"):
        if path.suffix not in {".md", ".ts", ".tsx", ".json"}:
            continue
        if "node_modules" in path.parts or ".git" in path.parts:
            continue
        text = path.read_text(encoding="utf-8")
        original = text
        for old, new in REPLACEMENTS:
            text = text.replace(old, new)
        if text != original:
            path.write_text(text, encoding="utf-8")
            changed += 1
            print(f"UPDATED {path.relative_to(ROOT)}")
    print(f"Done. {changed} files updated.")


if __name__ == "__main__":
    main()
