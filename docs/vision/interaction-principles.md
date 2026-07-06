---
id: interaction-principles
title: Interaction Principles
project: Arrival Atlas
system: Arrival Atlas
type: vision
domain: product
status: active
maturity: canonical
owner: design
tags:
  - interaction
  - motion
  - behavior
created: 2026-07-06
updated: 2026-07-06
related:
  - galaxy-design-language
  - cognitive-load-rules
---

# Interaction Principles

Rules for how Arrival Atlas **behaves** when touched.

---

## 1. When animation should happen

| Trigger | Animation purpose |
|---------|-------------------|
| **State change** | User must see what changed |
| **Causality** | User must see what caused what |
| **Attention** | User must notice the one next step |
| **Transition** | User must feel continuity between contexts |

**Duration discipline:**

- Micro feedback: ≤200ms  
- Instructional sequence: ≤3s unless user opts in  
- Celebration: ≤5s skippable  

---

## 2. When animation must never happen

| Situation | Why |
|-----------|-----|
| First paint before orientation | Anxiety |
| `prefers-reduced-motion` | Accessibility |
| Repeated return visits | Fatigue |
| Crisis entry paths | Urgency |
| Blocking save/error recovery | Hostility |
| Ambient loops with no state change | Distraction |

**Rule:** If you cannot name the lesson, remove the motion.

---

## 3. How unlocking should work

Unlock is **institutional reality becoming visible** — not level-up.

**Sequence (ideal):**

1. User completes cause (or records fact)  
2. System confirms save  
3. Map shows **why** lock removed  
4. Optional brief highlight of newly available nodes  
5. Guide states next step in plain language  

**Never:** Surprise unlock without cause · unlock sound without substance.

---

## 4. Discovery vs guidance

| User type | Default |
|-----------|---------|
| First visit | **Guided** |
| Crisis | **Guided** (aggressive) |
| Return, progressing | **Quiet map** |
| Power user | **Exploration** on request |

Discovery is for **optimization** — benefits mining, scenarios, what-if.

Guidance is for **survival** — registration, insurance, income.

**Never default stressed users to exploration.**

---

## 5. When the interface becomes quieter

Quiet after:

- User completes recommended step  
- User dismisses help twice in session  
- User demonstrates map literacy (selects correct node without guide)  
- User returns within 24h with progress  

Quiet means: **fewer words, same structure** — not empty screen.

---

## 6. When information should appear

| Information type | Timing |
|------------------|--------|
| **Next step** | Immediately on screen ready |
| **Prerequisites** | On lock interaction or hover |
| **Depth / legal detail** | On expand request |
| **Optimization opportunities** | After stability signals met |
| **Warnings** | Before irreversible action |

**Progressive disclosure is mandatory.**

---

## 7. When complexity may increase

Complexity unlocks when user has:

- At least one completed step **or**  
- Explicitly chosen “Explore scenarios / Compare options” **or**  
- Stable profile minimum viable for domain  

**Never** increase complexity to fill empty space.

---

## 8. Touch and mobile interactions

- Primary CTA in thumb zone  
- Navigation always reachable  
- No hover-only critical information  
- Inspector must not cover recommended node on small screens  

---

## 9. Keyboard and assistive interaction

- Galaxy navigable by keyboard  
- Focus visible always  
- Escape closes selection — predictable  
- Modals trap focus · restore on close  

---

## 10. Error interaction

Errors are **teaching moments**:

1. What happened (plain)  
2. What was not lost  
3. What to do now  

Never: error code only · alert() blocking · dead end.

---

## 11. Save interaction

Every write:

1. Disable double-submit immediately  
2. Show in-flight state  
3. Confirm success or partial success explicitly  
4. Update map before redirect  

---

## 12. Navigation interaction

- Back button must not orphan user  
- Deep links must land in comprehensible state  
- Cross-module jumps carry context (“You came from housing”)  

---

## Related documents

- [galaxy-design-language.md](./galaxy-design-language.md)
- [ux-principles.md](./ux-principles.md)
