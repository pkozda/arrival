#!/usr/bin/env python3
"""Docs migration: domain IA + YAML frontmatter."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"
FRONTMATTER_RE = re.compile(r"^---\n.*?\n---\n", re.DOTALL)


@dataclass
class DocMeta:
    rel_path: str
    id: str
    title: str
    type: str
    domain: str
    status: str = "active"
    maturity: str = "stable"
    tags: list[str] = field(default_factory=list)
    created: str = "2026-06-01"
    updated: str = "2026-06-19"
    related: list[str] = field(default_factory=list)

    def frontmatter(self) -> str:
        tags_yaml = "\n".join(f"  - {t}" for t in self.tags)
        if self.related:
            related_yaml = "\n".join(f"  - {r}" for r in self.related)
        else:
            related_yaml = "  []"
        return (
            f"---\nid: {self.id}\ntitle: {self.title}\ntype: {self.type}\n"
            f"domain: {self.domain}\nstatus: {self.status}\nmaturity: {self.maturity}\n"
            f"owner: system\ntags:\n{tags_yaml}\ncreated: {self.created}\n"
            f"updated: {self.updated}\nrelated:\n{related_yaml}\n---\n\n"
        )


MOVES: list[tuple[str, DocMeta]] = [
    ("product/current-state.md", DocMeta("core/current-state.md", "current-state", "Arrival Atlas Current State", "system", "core", tags=["platform-state", "module-catalog", "governance-kernel"], maturity="evolving")),
    ("specs/mrc-adl.md", DocMeta("core/mrc-adl.md", "mrc-adl", "MRC Architecture Decision Layer v1", "spec", "core", tags=["mrc-adl", "semantic-layer", "action-framework"], related=["module-runtime-contract-v1"])),
    ("specs/module-runtime-contract-v1.md", DocMeta("core/module-runtime-contract-v1.md", "module-runtime-contract-v1", "Module Runtime Contract v1", "spec", "core", tags=["module-runtime", "governance-kernel", "execution-pipeline"], related=["mrc-adl"])),
    ("product/profile-ux-spec.md", DocMeta("identity/profile-ux-spec.md", "profile-ux-spec", "Profile UX Design Specification", "ux", "identity", tags=["profile-mirror", "onboarding-ux", "situation-summary"], related=["profile-ux-discovery", "profile-system-v1-roadmap"])),
    ("research/profile-ux-discovery.md", DocMeta("identity/profile-ux-discovery.md", "profile-ux-discovery", "Profile UX Discovery Audit", "research", "identity", tags=["profile-mirror", "user-motivation", "hybrid-model"], related=["profile-ux-spec"])),
    ("architecture/user-profile-engine-design.md", DocMeta("identity/user-profile-engine-design.md", "user-profile-engine-design", "User Profile Engine Architecture Design", "system", "identity", tags=["profile-engine", "profile-merge", "data-model"], maturity="evolving")),
    ("roadmap/profile-system-v1.md", DocMeta("identity/profile-system-v1-roadmap.md", "profile-system-v1-roadmap", "Profile System v1 Roadmap", "roadmap", "identity", tags=["profile-engine", "user-context", "snapshot-integration"], related=["profile-ux-spec"])),
    ("refactors/mvp-r1-profile-merge-port.md", DocMeta("identity/mvp-r1-profile-merge-port.md", "mvp-r1-profile-merge-port", "MVP-R1 Profile Merge Port Refactor", "refactor", "identity", tags=["profile-merge", "module-sdk", "benefits-calculation"])),
    ("product/benefits-simulator-design.md", DocMeta("benefits/benefits-simulator-design.md", "benefits-simulator-design", "Benefits Simulator Product Design", "system", "benefits", tags=["benefits-calculation", "jobcenter", "scenario-simulation"])),
    ("contracts/benefits-simulator-ui-contract.md", DocMeta("benefits/benefits-simulator-ui-contract.md", "benefits-simulator-ui-contract", "Benefits Simulator UI Contract", "contract", "benefits", tags=["benefits-calculation", "ui-binding", "module-output"], related=["benefits-simulator-design"])),
    ("roadmap/benefits-simulator-implementation-plan.md", DocMeta("benefits/benefits-simulator-implementation-plan.md", "benefits-simulator-implementation-plan", "Benefits Simulator Implementation Plan", "roadmap", "benefits", tags=["benefits-calculation", "module-delivery"], related=["benefits-simulator-design"])),
    ("architecture/financial-module-v2-notes.md", DocMeta("finance/financial-module-v2-notes.md", "financial-module-v2-notes", "Financial Module v2 Architecture Notes", "system", "finance", tags=["financial-modeling", "household-income", "tax-class"])),
    ("roadmap/financial-module-v2-plan.md", DocMeta("finance/financial-module-v2-plan.md", "financial-module-v2-plan", "Financial Module v2 Plan", "roadmap", "finance", tags=["financial-modeling", "brutto-netto", "buergergeld"])),
    ("research/payroll-library-evaluation.md", DocMeta("finance/payroll-library-evaluation.md", "payroll-library-evaluation", "Payroll Library Evaluation", "research", "finance", tags=["financial-modeling", "payroll", "integration-research"], maturity="experimental")),
    ("product/system-translation-v2.md", DocMeta("product/system-translation-v2.md", "system-translation-v2", "System Translation v2 Product Concept", "system", "product", tags=["plain-language", "admin-terminology", "multilingual-ux"])),
    ("architecture/mrc-4-action-framework-blueprint.md", DocMeta("platform/mrc-4-action-framework-blueprint.md", "mrc-4-action-framework-blueprint", "MRC-4 Action Framework Execution Blueprint", "system", "platform", tags=["action-framework", "mrc-4", "execution-pipeline"], related=["mrc-adl"])),
    ("architecture/iam-phase-3-1-boundary-stabilization.md", DocMeta("platform/iam-phase-3-1-boundary-stabilization.md", "iam-phase-3-1-boundary-stabilization", "IAM Phase 3.1 Boundary Stabilization", "system", "platform", tags=["iam", "session-auth", "security-boundary"], related=["iam-evolution-roadmap"])),
    ("roadmap/mrc-6-to-platform.md", DocMeta("platform/mrc-6-to-platform-roadmap.md", "mrc-6-to-platform-roadmap", "MRC-6 to Platform Roadmap", "roadmap", "platform", tags=["product-contract", "ui-ready-gate", "platform-evolution"], related=["roadmap-vs-current-state"])),
    ("roadmap/iam-evolution.md", DocMeta("platform/iam-evolution-roadmap.md", "iam-evolution-roadmap", "IAM Evolution Roadmap", "roadmap", "platform", tags=["iam", "account-linking", "session-auth"])),
    ("specs/module-versioning-policy.md", DocMeta("platform/module-versioning-policy.md", "module-versioning-policy", "Module Versioning Policy", "spec", "platform", tags=["module-sdk", "semver", "schema-evolution"])),
    ("research/roadmap-vs-current-state.md", DocMeta("platform/roadmap-vs-current-state.md", "roadmap-vs-current-state", "Roadmap vs Current State Comparison", "research", "platform", tags=["platform-evolution", "gate-status", "delivery-tracking"], related=["mrc-6-to-platform-roadmap"])),
    ("adr/README.md", DocMeta("decisions/README.md", "decisions-index", "Architecture Decision Records Index", "system", "platform", tags=["adr", "decision-log"])),
]

IN_PLACE: list[DocMeta] = [
    DocMeta("audits/ui-ready-gate-audit.md", "ui-ready-gate-audit", "UI Ready Gate Audit", "audit", "platform", tags=["ui-ready-gate", "product-contract", "web-boundary"]),
    DocMeta("audits/ui-architecture-audit.md", "ui-architecture-audit", "UI Architecture Audit", "audit", "platform", tags=["contract-driven-ui", "module-scalability", "web-architecture"]),
    DocMeta("audits/platform-readiness-audit.md", "platform-readiness-audit", "Platform Readiness Audit", "audit", "platform", tags=["observability", "module-sdk", "health-endpoints"]),
    DocMeta("audits/platform-architecture-audit.md", "platform-architecture-audit", "Platform Architecture Audit", "audit", "platform", tags=["system-design", "module-ecosystem"]),
    DocMeta("audits/p7-0-module-runtime-architecture-audit.md", "p7-0-module-runtime-architecture-audit", "P7.0 Module Runtime Architecture Audit", "audit", "core", tags=["governance-kernel", "module-runtime"]),
    DocMeta("audits/p7-1-mrc-3-semantic-layer-gate-audit.md", "p7-1-mrc-3-semantic-layer-gate-audit", "P7.1 MRC-3 Semantic Layer Gate Audit", "audit", "core", tags=["mrc-3", "semantic-layer"]),
    DocMeta("audits/p7-2-mrc-5-registry-hardening-gate-audit.md", "p7-2-mrc-5-registry-hardening-gate-audit", "P7.2 MRC-5 Registry Hardening Gate Audit", "audit", "core", tags=["module-registry", "governance-kernel"]),
    DocMeta("audits/p6-2-identity-access-architecture-audit.md", "p6-2-identity-access-architecture-audit", "P6.2 Identity Access Architecture Audit", "audit", "platform", tags=["iam", "session-auth"]),
    DocMeta("audits/p6-3-iam-phase-3-1-final-architecture-audit.md", "p6-3-iam-phase-3-1-final-architecture-audit", "P6.3 IAM Phase 3.1 Final Architecture Audit", "audit", "platform", tags=["iam", "security-boundary"]),
    DocMeta("audits/p5-0-full-system-architecture-audit.md", "p5-0-full-system-architecture-audit", "P5.0 Full System Architecture Audit", "audit", "platform", tags=["system-design"]),
    DocMeta("audits/p4-1-system-state-architecture-audit.md", "p4-1-system-state-architecture-audit", "P4.1 System State Architecture Audit", "audit", "platform", tags=["system-state", "snapshot-projection"]),
    DocMeta("audits/user-data-persistence-lifecycle-audit.md", "user-data-persistence-lifecycle-audit", "User Data Persistence Lifecycle Audit", "audit", "identity", tags=["profile-merge", "session-persistence", "form-hydration"]),
    DocMeta("audits/system-comprehensive-audit.md", "system-comprehensive-audit", "System Comprehensive Audit", "audit", "platform", tags=["system-design"]),
    DocMeta("audits/frontend-ux-alignment-audit.md", "frontend-ux-alignment-audit", "Frontend UX Alignment Audit", "audit", "product", tags=["ux-alignment", "web-architecture"]),
    DocMeta("audits/mvp-r3-single-source-truth-audit.md", "mvp-r3-single-source-truth-audit", "MVP-R3 Single Source of Truth Audit", "audit", "identity", tags=["profile-engine", "data-model"]),
    DocMeta("audits/mvp-r3-phase3-removal-readiness.md", "mvp-r3-phase3-removal-readiness", "MVP-R3 Phase 3 Removal Readiness", "audit", "platform", tags=["legacy-removal"]),
    DocMeta("audits/mvp-r3-runtime-legacy-read-check.md", "mvp-r3-runtime-legacy-read-check", "MVP-R3 Runtime Legacy Read Check", "audit", "platform", tags=["legacy-removal"]),
    DocMeta("audits/mvp-r3-financial-policy-audit.md", "mvp-r3-financial-policy-audit", "MVP-R3 Financial Policy Audit", "audit", "finance", tags=["financial-modeling", "profile-policy"]),
    DocMeta("audits/financial-v2-validation-report.md", "financial-v2-validation-report", "Financial v2 Validation Report", "audit", "finance", tags=["financial-modeling", "validation"]),
    DocMeta("audits/financial-platform-readiness-audit.md", "financial-platform-readiness-audit", "Financial Platform Readiness Audit", "audit", "finance", tags=["financial-modeling"]),
    DocMeta("audits/financial-module-v2-implementation-report.md", "financial-module-v2-implementation-report", "Financial Module v2 Implementation Report", "audit", "finance", tags=["financial-modeling"]),
    DocMeta("audits/benefits-simulator-m1-1-hardening-report.md", "benefits-simulator-m1-1-hardening-report", "Benefits Simulator M1.1 Hardening Report", "audit", "benefits", tags=["benefits-calculation", "golden-scenarios"]),
    DocMeta("refactors/remove-ux-store.md", "remove-ux-store", "Remove UX Store Refactor", "refactor", "platform", tags=["snapshot-projection", "ui-state"]),
    DocMeta("refactors/snapshot-driven-language.md", "snapshot-driven-language", "Snapshot Driven Language Refactor", "refactor", "platform", tags=["snapshot-projection", "i18n"]),
    DocMeta("refactors/snapshot-driven-theme.md", "snapshot-driven-theme", "Snapshot Driven Theme Refactor", "refactor", "platform", tags=["snapshot-projection", "ui-preferences"]),
    DocMeta("refactors/snapshot-driven-ui-reconstruction.md", "snapshot-driven-ui-reconstruction", "Snapshot Driven UI Reconstruction", "refactor", "platform", tags=["snapshot-projection", "contract-driven-ui"]),
    DocMeta("refactors/snapshot-versioning-ordering.md", "snapshot-versioning-ordering", "Snapshot Versioning Ordering Refactor", "refactor", "platform", tags=["snapshot-projection", "system-state"]),
    DocMeta("archive/module-runtime-evolution-roadmap.md", "module-runtime-evolution-roadmap", "Module Runtime Evolution Roadmap", "roadmap", "core", status="archived", tags=["module-runtime"], related=["mrc-6-to-platform-roadmap"]),
    DocMeta("archive/user-profile-engine/phase0-report.md", "user-profile-engine-phase0-report", "User Profile Engine Phase 0 Report", "audit", "identity", status="archived", tags=["profile-engine"]),
    DocMeta("archive/user-profile-engine/runtime-unification-report.md", "user-profile-engine-runtime-unification-report", "User Profile Engine Runtime Unification Report", "audit", "identity", status="archived", tags=["profile-engine", "execution-context"]),
    DocMeta("archive/user-profile-engine/policy-layer-report.md", "user-profile-engine-policy-layer-report", "User Profile Engine Policy Layer Report", "audit", "identity", status="archived", tags=["profile-policy", "data-access"]),
    DocMeta("archive/user-profile-engine/execution-trace-report.md", "user-profile-engine-execution-trace-report", "User Profile Engine Execution Trace Report", "audit", "identity", status="archived", tags=["profile-engine", "execution-trace"]),
    DocMeta("archive/user-profile-engine/ui-contract-report.md", "user-profile-engine-ui-contract-report", "User Profile Engine UI Contract Report", "audit", "identity", status="archived", tags=["profile-engine", "ui-contract"]),
    DocMeta("archive/README.md", "archive-index", "Documentation Archive Index", "system", "platform", status="archived", tags=["archive", "superseded-docs"]),
]


def strip_fm(text: str) -> str:
    return FRONTMATTER_RE.sub("", text, count=1) if FRONTMATTER_RE.match(text) else text


def apply_fm(path: Path, meta: DocMeta) -> None:
    path.write_text(meta.frontmatter() + strip_fm(path.read_text(encoding="utf-8")).lstrip("\n"), encoding="utf-8")


def main() -> None:
    for domain in ["onboarding", "migration", "housing", "legal", "integrations"]:
        d = DOCS / domain
        d.mkdir(parents=True, exist_ok=True)
        readme = d / "README.md"
        if not readme.exists():
            readme.write_text(
                DocMeta(
                    f"{domain}/README.md",
                    f"{domain}-domain-index",
                    f"{domain.title()} Domain Index",
                    "system",
                    domain,
                    maturity="experimental",
                    tags=["domain-index", domain.replace("-", "")],
                ).frontmatter()
                + f"# {domain.title()} domain\n\nReserved for {domain}-specific documentation.\n",
                encoding="utf-8",
            )

    for old, meta in MOVES:
        src, dst = DOCS / old, DOCS / meta.rel_path
        if not src.exists():
            print(f"SKIP {old}")
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.resolve() != dst.resolve():
            src.rename(dst)
            print(f"MOVE {old} -> {meta.rel_path}")

    for meta in IN_PLACE:
        p = DOCS / meta.rel_path
        if p.exists():
            apply_fm(p, meta)

    for _, meta in MOVES:
        p = DOCS / meta.rel_path
        if p.exists():
            apply_fm(p, meta)

    # Remove empty legacy dirs
    for d in ["product", "architecture", "specs", "contracts", "roadmap", "research", "adr"]:
        p = DOCS / d
        if p.exists() and p.is_dir() and not any(p.iterdir()):
            p.rmdir()
            print(f"RMDIR empty {d}/")

    print("Migration complete.")


if __name__ == "__main__":
    main()
