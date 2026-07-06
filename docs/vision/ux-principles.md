---
id: ux-principles
title: Arrival Atlas — Immutable UX Principles
project: Arrival Atlas
system: Arrival Atlas
type: vision
domain: product
status: active
maturity: canonical
owner: design
tags:
  - principles
  - ux
  - standards
created: 2026-07-06
updated: 2026-07-06
related:
  - cognitive-load-rules
  - interaction-principles
---

# Immutable UX Principles

These principles are **constitutional**. They outrank feature requests, aesthetics, and engineering convenience.

When two principles conflict, the one **closer to user safety and clarity** wins.

Each principle includes: explanation · rationale · good example · anti-pattern.

---

## 1. One primary next step

**Explanation:** At any moment, the user should see exactly one recommended action ranked above all others.

**Rationale:** Stress collapses decision-making. Multiple equal CTAs feel like abandonment.

**Good example:** “Register your address — this unlocks health insurance and benefits applications.” [Do this]

**Anti-pattern:** Three primary buttons: “Explore”, “Start”, “Learn more” with equal visual weight.

---

## 2. Every screen answers three questions

**Explanation:** Where am I? · Why am I here? · What happens next?

**Rationale:** GOV.UK’s core discipline — orientation before content.

**Good example:** Page title: “Your housing situation” · subtitle: “We use this to check rent support eligibility” · CTA: “Update your rent”

**Anti-pattern:** “Economic Reality” with no subtitle and twelve peer nodes.

---

## 3. Calm before complexity

**Explanation:** Reduce emotional noise before introducing structure.

**Rationale:** Panic prevents comprehension. Calm is functional, not aesthetic.

**Good example:** Single sentence reassurance, then map, then detail.

**Anti-pattern:** Immediate modal + form + animation + four panels on first paint.

---

## 4. Reduce uncertainty before adding information

**Explanation:** Tell users what is known, unknown, and unknowable — before new data.

**Rationale:** Information without certainty increases anxiety.

**Good example:** “We’re not sure yet if you qualify for X — adding your income will tell us.”

**Anti-pattern:** Dumping ten eligibility criteria with no confidence signal.

---

## 5. Guide before exploration

**Explanation:** First-time users receive narration; exploration is earned.

**Rationale:** Exploration is a reward for confidence, not a prerequisite for survival.

**Good example:** Highlighted next step with plain explanation; “Browse map” is secondary.

**Anti-pattern:** Empty galaxy with “figure it out.”

---

## 6. Progress before navigation

**Explanation:** Show what changed before offering new destinations.

**Rationale:** Users need closure loops to trust the system.

**Good example:** “You completed registration. Housing and benefits are now available.”

**Anti-pattern:** Silent save → redirect → unrelated module.

---

## 7. Never punish curiosity

**Explanation:** Clicking locked, wrong, or premature items teaches — never shames.

**Rationale:** Users test boundaries to learn.system rules.

**Good example:** “You can’t apply yet because registration is incomplete. [Go to registration]”

**Anti-pattern:** “Error” or mute padlock with no explanation.

---

## 8. Every animation teaches something

**Explanation:** Motion must reveal cause, sequence, or state change.

**Rationale:** Decorative motion under stress reads as instability.

**Good example:** Route animation showing prerequisite chain before unlock.

**Anti-pattern:** Ambient orbit spin on first visit with no instructional purpose.

---

## 9. Every interaction reduces anxiety

**Explanation:** If an interaction increases worry without increasing capability, remove it.

**Rationale:** Our users are already at capacity.

**Good example:** Confirm save with plain language: “Your rent is saved on this device.”

**Anti-pattern:** “Session recreated” without explaining impact on answers.

---

## 10. Bureaucracy must become understandable

**Explanation:** Every official concept gets a human subtitle the first time it appears.

**Rationale:** Jargon is a gatekeeping mechanism.

**Good example:** “Anmeldung — register your address at the city office”

**Anti-pattern:** “benefits-support domain” as the only label.

---

## 11. Every visual element justifies its existence

**Explanation:** If removing an element does not reduce clarity, remove it.

**Rationale:** Visual noise is cognitive noise.

**Good example:** Dimmed non-relevant nodes during focus.

**Anti-pattern:** Particles, parallax, and glow with no semantic role.

---

## 12. Honesty over comfort

**Explanation:** Tell users hard truths clearly — demo limits, uncertainty, data loss.

**Rationale:** False comfort destroys trust permanently.

**Good example:** “This is a preview. Your answers are stored on this device only.”

**Anti-pattern:** “Enter Atlas” implying official account or government access.

---

## 13. Dependencies are first-class UX

**Explanation:** Prerequisites are not edge cases — they are the product.

**Rationale:** Most migrant pain is sequencing errors.

**Good example:** Visible route from completed step to newly unlocked step.

**Anti-pattern:** Flat checklist with hidden order.

---

## 14. Language is infrastructure

**Explanation:** Users must read in their chosen language at every layer — including guidance.

**Rationale:** Navigation without language is exclusion.

**Good example:** Guide, inspector, and errors in German when user selects DE.

**Anti-pattern:** Localized forms with English-only coach overlay.

---

## 15. Mobile is the primary reality

**Explanation:** Design for one hand, interrupted attention, and small screens first.

**Rationale:** Many migrants’ only computer is a phone.

**Good example:** Persistent bottom nav to four lenses; thumb-reachable primary CTA.

**Anti-pattern:** Hidden navigation at 960px with no replacement.

---

## 16. Dead ends are unacceptable

**Explanation:** Every error state offers recovery — home, retry, or human path.

**Rationale:** Helplessness triggers abandonment and bad real-world decisions.

**Good example:** “We can’t find that page. [Go to your situation] [Get help with registration]”

**Anti-pattern:** “Module not found.” full stop.

---

## 17. Forms are conversations, not interrogations

**Explanation:** Ask minimum viable questions with visible purpose per field.

**Rationale:** Forms feel like authority tests under stress.

**Good example:** “Your monthly rent — used to estimate housing support”

**Anti-pattern:** Cold-start gate blocking the entire map before trust exists.

---

## 18. Celebration is proportional

**Explanation:** Acknowledge progress without infantilizing.

**Rationale:** Adults in crisis need dignity, not gamification.

**Good example:** Brief “Route opened” with substance — what unlocked and why.

**Anti-pattern:** 15-second unskippable cinematic before urgent next step.

---

## 19. Silence is a design choice

**Explanation:** When nothing needs saying, say nothing.

**Rationale:** Constant narration erodes trust in signal.

**Good example:** Returning user lands directly on updated map — no welcome replay.

**Anti-pattern:** Re-showing onboarding deck on every visit.

---

## 20. The map persists; the guide fades

**Explanation:** Spatial situation model remains; hand-holding intensity decreases.

**Rationale:** Independence is success, not churn.

**Good example:** Week 3 user navigates without modal — map still shows locks and routes.

**Anti-pattern:** Removing all structure once guide is dismissed.

---

## 21. One overlay at a time

**Explanation:** Never stack modal responsibilities.

**Rationale:** Split attention under stress causes errors and rage-quits.

**Good example:** Intake completes → then guide welcome → then recommendation.

**Anti-pattern:** Welcome dialog + intake form simultaneously.

---

## 22. Writes must close the loop

**Explanation:** Every save, submit, or mutation gets explicit confirmation.

**Rationale:** Users cannot infer success from UI disappearance.

**Good example:** “Saved. Benefits estimate will update.”

**Anti-pattern:** Overlay vanishes with no message.

---

## 23. Complexity is opt-in

**Explanation:** Default to simple; reveal depth on demand.

**Rationale:** Expert users and curious users choose complexity — novices must not wade through it.

**Good example:** “Why am I seeing this?” expandable detail.

**Anti-pattern:** Inspector showing five sections expanded by default.

---

## 24. Accessibility is clarity for everyone

**Explanation:** Plain language, focus order, reduced motion, and contrast serve stressed users first.

**Rationale:** Cognitive accessibility overlaps physical accessibility.

**Good example:** Skip link, focus trap on critical dialogs, reduced-motion path.

**Anti-pattern:** `window.alert` for errors; keyboard traps in galaxy.

---

## 25. Design for the worst day

**Explanation:** Evaluate every flow as if the user is crying, on a bus, in a foreign language, with 3% battery.

**Rationale:** Average-day design fails migrants on arrival day.

**Good example:** Offline-tolerant messaging; retry; preserved partial progress.

**Anti-pattern:** “Works on desktop when calm.”

---

## Using these principles

Before shipping any screen, ask:

1. Which principles does this strengthen?
2. Which does it violate?
3. If violated, is there an explicit vision-level exception documented?

No exception without written rationale in design review.

---

## Related documents

- [cognitive-load-rules.md](./cognitive-load-rules.md) — measurable limits
- [interaction-principles.md](./interaction-principles.md) — motion and unlock behavior
