---
id: cognitive-load-rules
title: Cognitive Load Rules — Measurable Limits
project: Arrival Atlas
system: Arrival Atlas
type: vision
domain: product
status: active
maturity: canonical
owner: design
tags:
  - cognitive-load
  - metrics
  - qa
created: 2026-07-06
updated: 2026-07-06
related:
  - ux-principles
  - interaction-principles
---

# Cognitive Load Rules

Principles are qualitative. These rules are **testable**.

Use in design review, QA, and usability sessions. **Fail = do not ship.**

---

## 1. Simultaneous decisions

| Rule | Limit |
|------|-------|
| **Maximum concurrent decisions** | **1** primary decision per viewport |
| Secondary choices | ≤2, visually subordinate (ghost / link) |
| Mode elections | **0** on first visit |

**Test:** Squint test — one button should dominate at 5 feet.

---

## 2. Primary CTAs

| Rule | Limit |
|------|-------|
| **Primary CTAs per screen** | **1** |
| Destructive CTAs | Separate visual tier; never adjacent to primary without gap |

**Test:** Count elements with primary button styling — must be ≤1.

---

## 3. Attention hotspots

| Rule | Limit |
|------|-------|
| **Competing focal points** | ≤3 (primary CTA · map focus · guide probe) |
| Animated focal points | ≤1 at a time |

**Test:** Eye-tracking or 5-second screenshot test — observers must agree on primary focal point.

---

## 4. Overlays

| Rule | Limit |
|------|-------|
| **Modal overlays stacked** | **0** — one at a time |
| **Total overlay layers** | ≤1 modal + ≤1 non-blocking toast |
| Full-screen blockers before first value | **0** |

**Test:** First visit to Life Events — count modal roots — must be ≤1.

---

## 5. Motion

| Rule | Limit |
|------|-------|
| **Instructional animation duration** | ≤3s default; skippable if >3s |
| **Ambient looping animation on first visit** | **0** |
| **Concurrent motion sequences** | 1 |

**Test:** `prefers-reduced-motion` — zero non-essential animation.

---

## 6. Reading before action

| Rule | Limit |
|------|-------|
| **Words before first action** | ≤60 words (excluding legal footer) |
| **Words in first recommendation** | ≤40 words |
| **Jargon without translation** | 0 on first session |

**Test:** Word count first screenful on mobile 375px.

---

## 7. Uncertainty

| Rule | Limit |
|------|-------|
| **Unlabeled locks** | 0 |
| **Actions without feedback** | 0 |
| **Silent state changes** | 0 |

**Test:** Complete one save — user must quote what changed without guessing.

---

## 8. Navigation reachability

| Rule | Limit |
|------|-------|
| **Taps to any primary lens** | ≤2 from anywhere |
| **Hidden primary nav without alternative** | **0** at any breakpoint |

**Test:** 375px — reach Profile, Life plan, Money/support, Home without URL bar.

---

## 9. Inspector complexity

| Rule | Limit |
|------|-------|
| **Expanded inspector sections by default** | ≤2 |
| **Actions in inspector** | 1 primary · ≤2 secondary |

---

## 10. Form cognitive load

| Rule | Limit |
|------|-------|
| **Fields per screen (onboarding)** | ≤5 |
| **Fields without purpose string** | 0 |
| **Required fields before showing map** | ≤3 |

---

## 11. Language consistency

| Rule | Limit |
|------|-------|
| **Languages mixed in one viewport** | 0 |
| **Guide language ≠ UI language** | 0 |

---

## 12. Error recovery

| Rule | Limit |
|------|-------|
| **Dead-end screens** | 0 |
| **Recovery CTAs on error** | ≥1 |

---

## Cognitive load scorecard (review template)

Rate each screen 1–10 (10 = worst). **Ship threshold: no dimension >6; average ≤4.**

| Dimension | Score |
|-----------|-------|
| Decision count | |
| Visual competition | |
| Overlay stack | |
| Motion noise | |
| Reading burden | |
| Uncertainty | |
| Navigation escape | |

---

## Relationship to audits

These rules codify findings from:

- [ux-cognition-audit-immigrant-persona.md](../audits/ux-cognition-audit-immigrant-persona.md)  
- [production-readiness-ui-ux-audit.md](../audits/production-readiness-ui-ux-audit.md)  

Audits diagnose. These rules **prevent regression**.

---

## Related documents

- [ux-principles.md](./ux-principles.md)
- [onboarding-philosophy.md](./onboarding-philosophy.md)
