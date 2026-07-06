---
id: ux-cognition-audit-immigrant-persona
title: UX Cognition Audit — Stressed First-Time Immigrant Persona
project: Arrival Atlas
system: Arrival Atlas
type: audit
domain: product
status: active
maturity: draft
owner: system
tags:
  - ux
  - cognition
  - accessibility
  - immigrant-persona
  - cognitive-load
created: 2026-07-06
updated: 2026-07-06
related:
  - product-walkthrough-ux-consultant
  - production-readiness-ui-ux-audit
  - malicious-beta-tester-ux-audit
  - phase-1-release-blockers
---

# UX Cognition Audit — Arrival Atlas

**Reviewer lens:** Senior UX Researcher (Apple clarity + GOV.UK plain language + Airbnb emotional design)  
**Persona:** First-time immigrant in Germany — stressed, limited German, not tech-savvy, urgent need  
**Method:** Cognitive walkthrough of every screen — **no code review**  
**Date:** July 2026

> This audit judges what the product *feels like* under pressure, not how it is built.

---

## Persona constraints

| Factor | Implication |
|--------|-------------|
| Stress / urgency | Low tolerance for ambiguity; needs one obvious next step |
| Limited German | English UI helps; German bureaucratic terms without explanation harm trust |
| First visit | No mental model for “galaxy”, “demo”, or “session” |
| Low tech literacy | Metaphors must earn their keep; hidden nav is catastrophic |
| High stakes | Errors feel like data loss; silent resets feel like betrayal |

---

# Part A — Per-screen cognitive analysis

For each screen: **5-second comprehension**, primary action, attention competition, confusion risks, assumptions, “what next?”, load **1–10**.

---

## A1. Bootstrap loading

| Question | Assessment |
|----------|------------|
| **5-second read** | “Something is loading.” Not what or why. |
| **Primary action** | Wait — no alternative |
| **Obvious?** | Yes — spinner is universal |
| **Attention competition** | Skeleton + “Loading…” only |
| **Confusion** | Long load on slow network → “Is it broken?” |
| **Assumptions** | User knows to wait; has network |
| **What next?** | Unclear until content appears |
| **Cognitive load** | **3/10** — low complexity, moderate anxiety |

---

## A2. Bootstrap error

| Question | Assessment |
|----------|------------|
| **5-second read** | “App failed to start.” |
| **Primary action** | Retry |
| **Obvious?** | Mostly — if error message is plain language |
| **Confusion** | Technical error strings destroy trust |
| **Assumptions** | User understands “session” / “bootstrap” if exposed |
| **What next?** | Retry — good |
| **Cognitive load** | **6/10** — failure under stress spikes load |

---

## A3. Session recreated modal

| Question | Assessment |
|----------|------------|
| **5-second read** | “My previous work might be gone.” (post arr-032: clearer copy) |
| **Primary action** | Continue |
| **Obvious?** | Single button — yes |
| **Attention competition** | Modal blocks everything — correct for severity |
| **Confusion** | “Session” is developer language; user thinks “my answers” |
| **Assumptions** | User reads full message while stressed |
| **What next?** | Continue — but **what happens after** is unclear |
| **Cognitive load** | **8/10** — high emotional + informational load |

---

## A4. Guest landing (`/` — not exploring)

| Question | Assessment |
|----------|------------|
| **5-second read** | “This is a fancy map about starting a new life.” |
| **Primary action** | **Enter Atlas** |
| **Obvious?** | CTA visible — good |
| **Attention competition** | Headline · animated map · two CTAs that do the **same thing** |
| **Confusion** | “Enter Atlas” vs “See what's next in 7 days” — **false choice** |
| **Assumptions** | User knows “Atlas” = this app, not a government system |
| **What next?** | Enter Atlas — yes |
| **Cognitive load** | **5/10** — marketing is calm but metaphor unexplained |

---

## A5. Member slider (`/` — exploring)

| Question | Assessment |
|----------|------------|
| **5-second read** | “A presentation with a map and slides.” |
| **Primary action** | Unclear — slide rail? map nodes? bottom CTA? |
| **Attention competition** | **High** — rail · map · side panel · timeline · HUD nav · slide CTA |
| **Confusion** | Six slides feel like onboarding deck, not urgent help |
| **Assumptions** | User wants orientation before action; understands slide metaphor |
| **What next?** | Slide CTA changes per slide — **must read slide** to know |
| **Cognitive load** | **7/10** — beautiful but cognitively dense |

---

## A6. Atlas HUD (exploring)

| Question | Assessment |
|----------|------------|
| **5-second read** | “Top menu for main areas.” |
| **Primary action** | Context-dependent — nav item or Leave demo |
| **Obvious?** | Desktop: yes. **Mobile ≤960px: nav vanishes** — **critical failure** |
| **Attention competition** | Logo · 4 nav items · Leave demo (destructive adjacent to nav) |
| **Confusion** | “Leave demo” — user may not know they're in a “demo” |
| **Assumptions** | User entered demo deliberately; understands four destinations |
| **What next?** | Nav provides IA — when visible |
| **Cognitive load** | **4/10 desktop · 9/10 mobile** (lost navigation) |

---

## A7. Life Events galaxy — loading

| Question | Assessment |
|----------|------------|
| **5-second read** | “Loading my plan.” |
| **Primary action** | Wait |
| **Obvious?** | Yes |
| **Cognitive load** | **3/10** |

---

## A8. Life Events — Journey Guide welcome

| Question | Assessment |
|----------|------------|
| **5-second read** | “Something wants to give me a tour.” |
| **Primary action** | Start Guided Journey **or** Explore On My Own |
| **Obvious?** | Two choices — **choice paralysis** under stress |
| **Attention competition** | Modal vs galaxy behind vs possible intake overlay **stacked** |
| **Confusion** | “Guided Journey” vs “Explore On My Own” — consequence unclear |
| **Assumptions** | User wants coaching; speaks English |
| **What next?** | Must decide mode before seeing content — **friction** |
| **Cognitive load** | **7/10** |

---

## A9. Life Events — cold-start intake overlay

| Question | Assessment |
|----------|------------|
| **5-second read** | “I must fill a form before I see anything.” |
| **Primary action** | Submit intake |
| **Obvious?** | Form fields direct action |
| **Attention competition** | Intake vs Guide welcome — **dual overlays** |
| **Confusion** | Why can't I look first? Feels like a gate |
| **Assumptions** | User has answers ready; trusts app with data |
| **What next?** | Submit — clear |
| **Cognitive load** | **8/10** — form under stress without prior trust |

---

## A10. Life Events — guided galaxy (active)

| Question | Assessment |
|----------|------------|
| **5-second read** | “Space map with a glowing helper.” |
| **Primary action** | Click highlighted planet / follow guide panel |
| **Obvious?** | **Moderate** — if guide open; **low** if dismissed |
| **Attention competition** | Planets · edges · probe · speech · inspector · Scenarios drawer |
| **Confusion** | Planets unlabeled at glance; locks unexplained without click |
| **Assumptions** | User understands dependencies, missions, unlocks |
| **What next?** | Guide answers this **when panel open** — best screen in product |
| **Cognitive load** | **6/10 guided · 9/10 without guide** |

---

## A11. Life Events — locked planet

| Question | Assessment |
|----------|------------|
| **5-second read** | “I can't do this yet.” |
| **Primary action** | Take Me There |
| **Obvious?** | Good when guide speech opens |
| **Confusion** | Padlock alone doesn't explain **why** before click |
| **Cognitive load** | **5/10** with guide · **7/10** without |

---

## A12. Life Events — cinematic unlock

| Question | Assessment |
|----------|------------|
| **5-second read** | “Something good happened.” |
| **Primary action** | Watch / wait |
| **Obvious?** | Emotionally clear; informationally brief |
| **Attention competition** | Full-screen takeover — appropriate |
| **Confusion** | Duration ~10s+ — impatient user may feel blocked |
| **Assumptions** | User enjoys reward animation; doesn't need to act urgently |
| **What next?** | Replay or continue — appears after |
| **Cognitive load** | **4/10** delight · **7/10** if urgent |

---

## A13. Economic Reality galaxy

| Question | Assessment |
|----------|------------|
| **5-second read** | “Another space map about money.” |
| **Primary action** | Select a card-planet |
| **Obvious?** | **Low** — “Economic Reality” is abstract |
| **Attention competition** | Same galaxy chrome as Life Events — **pattern fatigue** |
| **Confusion** | Difference vs Life Events unclear for novice |
| **Assumptions** | User already understands galaxy idiom |
| **What next?** | Guide helps if welcome not dismissed; else weak |
| **Cognitive load** | **7/10** |

---

## A14. Profile galaxy (summary)

| Question | Assessment |
|----------|------------|
| **5-second read** | “My situation as planets.” |
| **Primary action** | Select domain to inspect |
| **Obvious?** | Moderate — center “Your situation” helps |
| **Confusion** | Domain names (e.g. benefits-support) may be jargon |
| **Assumptions** | User knows which domain they need |
| **What next?** | Inspector actions — Edit / View full domain |
| **Cognitive load** | **6/10** |

---

## A15. Profile domain edit form

| Question | Assessment |
|----------|------------|
| **5-second read** | “A normal form — finally familiar.” |
| **Primary action** | Save |
| **Obvious?** | **Yes** — best affordance clarity in product |
| **Attention competition** | Form fields only — relief |
| **Confusion** | Leaving galaxy metaphor without warning |
| **Assumptions** | User knows correct bureaucratic answers |
| **What next?** | Save — clear; toast confirms after redirect |
| **Cognitive load** | **5/10** |

---

## A16. Generic module page (`/modules/financial-reality`)

| Question | Assessment |
|----------|------------|
| **5-second read** | “A different, older-looking form.” |
| **Primary action** | Fill and submit |
| **Confusion** | **Same topic, different UI** vs Economic Reality galaxy |
| **Cognitive load** | **7/10** — breaks mental model |

---

## A17. Inline not-found states

| Question | Assessment |
|----------|------------|
| **5-second read** | “Error. Dead end.” |
| **Primary action** | None provided |
| **Cognitive load** | **9/10** — helplessness |

---

## A18. Leave demo confirm

| Question | Assessment |
|----------|------------|
| **5-second read** | “I might lose my data.” |
| **Primary action** | Start over vs Keep exploring |
| **Obvious?** | Yes — copy explains consequences (arr-032) |
| **Cognitive load** | **6/10** |

---

# Part B — Cross-product cognition review

## B1. Is the galaxy metaphor helping or decoration?

| Verdict | **Mixed — trending decoration**
|--------|------------------------------|
| **Helps when** | Journey Guide attaches mission language to planets; locked/unlock states teach dependencies; cinematic unlock rewards progress |
| **Decoration when** | Home star map (guest) is non-interactive; Economic Reality cards as planets don't map to user mental models; Profile domains as planets add visual noise vs a simple checklist |
| **Risk** | User learns “this app is a game map” not “this app gets me benefits / registration done” |

**Recommendation:** Galaxy must always answer **“what bureaucratic thing is this?”** in plain language within 1 click. Inspector Context section is critical — often below fold.

---

## B2. Are planets self-explanatory?

**No** — at a glance planets are colored orbs with short labels. Labels like “Registration” or card codes are insufficient without inspector. Lock icons help only after user tries and fails.

**Grade: 4/10** self-explanatory at first glance · **7/10** after guide onboarding

---

## B3. Does motion guide attention or distract?

| Motion type | Effect |
|-------------|--------|
| Guide probe pulse | **Guides** — good |
| Route preview traversal | **Guides** — excellent |
| Cinematic unlock | **Guides + rewards** — good if skippable when urgent |
| Ambient orbit spin | **Distracts** — peripheral noise under stress |
| Home map particles | **Distracts** — aesthetic |
| Parallax spatial canvas | **Neutral** — low impact |

**Reduced-motion support exists** — essential for stress + vestibular sensitivity.

**Verdict:** Motion is **over-used** at entry, **well-used** in guide flows.

---

## B4. Is information architecture obvious?

| Layer | Clarity |
|-------|---------|
| HUD four destinations | **Good** (desktop) |
| Home vs modules | **Weak** — home is pitch deck, modules are work |
| Life Events vs Economic Reality vs Profile | **Weak** for novice — overlap in “money” and “situation” |
| financial-reality vs economic-reality | **Broken** — same concept, two UIs |
| Generic modules | **Invisible** — not in HUD |

**Grade: 5/10**

---

## B5. Does every interaction reduce uncertainty?

| Interaction | Uncertainty reduced? |
|-------------|---------------------|
| Enter Atlas | **Partial** — enters demo, not explained |
| Guide welcome choice | **No** — adds decision |
| Guided recommendation | **Yes** — strongest moment |
| Profile save + toast | **Yes** |
| Session recreate notice | **Yes** (post arr-032) |
| Silent intake success | **No** — no confirmation |
| Module form submit | **Partial** — results panel varies |

**Grade: 5/10**

---

## B6. Does every screen answer the three questions?

| Question | Product average |
|----------|-----------------|
| **Where am I?** | HUD + viewport labels help on destinations; home is ambiguous; mobile nav hidden |
| **What is this?** | Marketing home answers well; galaxy screens assume prior metaphor knowledge |
| **What do I do next?** | **Only reliable in guided Life Events**; elsewhere user must explore |

---

# Part C — Problem synthesis

## Biggest UX problems

1. **Mobile navigation disappearance** — user literally cannot reach modules from HUD on phone
2. **Split economic module** — two routes, two experiences, destroys trust
3. **Guest cannot discover modules** — must Enter Atlas or guess URLs
4. **No branded 404 / recovery** — dead ends without escape
5. **Home slider competes with urgent task** — six slides before action
6. **English-only guide + inspector** while modules partially localized — language schizophrenia

## Biggest cognitive problems

1. **Dual overlay stacking** (Guide welcome + intake) on first Life Events visit
2. **False secondary CTAs** on guest landing (two buttons, same action)
3. **Galaxy without guide** — high spatial cognitive load, low signifiers
4. **Abstract naming** — “Economic Reality”, “Explore Atlas”, “Leave demo”
5. **Mode choice paralysis** — Guided vs Independent before user sees value

## Biggest onboarding problems

1. No plain-language “this is a demo preview, not government” disclaimer
2. Journey Guide asks commitment before showing benefit
3. Cold-start intake before trust established
4. No language selection at front door (picker unmounted)
5. Member slider assumes user wants 6-slide tour, not “help me register”

## Biggest navigation problems

1. Mobile HUD nav hidden ≤960px
2. `financial-reality` vs `economic-reality` split
3. Profile galaxy doesn't update URL on selection
4. Home map nodes change slides, don't navigate — user expects click = go
5. Generic modules unreachable from HUD

## Biggest emotional problems

1. **Fear of data loss** — session recreate, leave demo (mitigated but “session” language remains)
2. **Betrayal of trust** — demo implied exploration but empty profile after recreate felt like “still exploring” (fixed arr-032)
3. **Overwhelm** — dark immersive UI + motion + multiple panels
4. **Alienation** — space metaphor when user wants human reassurance
5. **Abandonment** — inline errors without “go home” link

---

# Part D — Prioritized roadmap

## P0 — Must fix before public beta

| # | Item | Rationale |
|---|------|-----------|
| P0-1 | **Mobile navigation** — drawer or bottom bar with 4 HUD destinations | Without this, mobile users are trapped |
| P0-2 | **Unify economic routing** — one canonical `/modules/economic-reality` galaxy; retire or redirect `financial-reality` | Split-brain destroys comprehension |
| P0-3 | **Language picker in AtlasHUD** | Persona doesn't speak English; picker exists but hidden |
| P0-4 | **Branded not-found + recovery links** | Dead ends under stress = instant churn |
| P0-5 | **Session recreate copy in plain language** — “Your saved answers on this device were reset” not “session” | Emotional trust |
| P0-6 | **Prevent Guide + intake overlay stack** — sequence: intake OR welcome, never both | Cognitive overload on first task |
| P0-7 | **Guest path to one urgent task** — e.g. “I need to register” shortcut bypassing 6 slides | Time-to-value |

## P1 — High impact, soon after P0

| # | Item | Rationale |
|---|------|-----------|
| P1-1 | Localize Journey Guide + inspector boilerplate (DE minimum) | Guide is English-only coaching layer |
| P1-2 | Rename CTAs for clarity — “Start preview” not “Enter Atlas”; explain demo | Honest expectations |
| P1-3 | Profile URL sync on galaxy selection | Shareable, back-button sane |
| P1-4 | Intake success confirmation message | Uncertainty reduction |
| P1-5 | Skip / reduce member slider for returning users | Less deck, more action |
| P1-6 | Honor `?entry=CRISIS` on Economic Reality or stop generating link | Broken promise |
| P1-7 | Inline error recovery CTAs (“Back to home”, “Try Life Events”) | Navigation safety net |
| P1-8 | Cinematic unlock skip control when `prefers-reduced-motion` or repeat visit | Urgency respect |

## P2 — Polish and comprehension

| # | Item | Rationale |
|---|------|-----------|
| P2-1 | Planet labels — subtitle with bureaucratic translation (“Anmeldung — city registration”) | Self-explanatory planets |
| P2-2 | Consolidate guest secondary CTA — remove duplicate “7 days” or make it distinct | False choice fix |
| P2-3 | Home map click → navigate (optional) not only slide change | Affordance match |
| P2-4 | “What is this page?” one-line helper under viewport title per module | IA clarity |
| P2-5 | Guide default to guided for first visit; explain Independent as “I'll explore alone” | Reduce paralysis |
| P2-6 | HUD discoverability for high-value generic modules (benefits-simulator) | Opportunity mining |
| P2-7 | Emotional reassurance microcopy on stressful forms (profile edit) | GOV.UK tone |

## P3 — Future excellence

| # | Item | Rationale |
|---|------|-----------|
| P3-1 | Galaxy optional — list/timeline mode for low-cognitive users | Accessibility of metaphor |
| P3-2 | Predictive “urgent path” from persona (single CTA on home) | Airbnb-style personalization |
| P3-3 | Human voice / video explainer for first galaxy visit | Emotional safety |
| P3-4 | Offline / save-progress indicator | Anxiety reduction |
| P3-5 | MBDE benefits discovery user surface (not admin) | Tangible value proposition |
| P3-6 | Life-event simulation from Economic Reality | Cross-module coherence |

---

# Part E — Executive verdict

| Dimension | Score (1–10) | Notes |
|-----------|--------------|-------|
| First-visit comprehension | **4** | Marketing clear; task path unclear |
| Task completion confidence | **6** | Strong when Guide active |
| Mobile usability | **3** | Nav hidden — critical |
| Language accessibility | **4** | Partial i18n |
| Emotional safety | **5** | Improving (arr-032); still technical copy |
| Information architecture | **5** | Good bones, broken edges |
| Metaphor coherence | **6** | Excellent in guided LE; weak elsewhere |

**Overall cognitive readiness for stressed immigrant persona: 4.5 / 10**

The product has a **world-class guided galaxy moment** inside Life Events — but reaching it requires surviving bootstrap, marketing home, optional slide deck, demo entry, possible dual overlays, and (on mobile) navigation blindness. The gap between **delight in the core** and **friction at the door** is the primary strategic UX debt.

---

## Related documents

- [product-walkthrough-ux-consultant.md](./product-walkthrough-ux-consultant.md) — full screen inventory
- [production-readiness-ui-ux-audit.md](./production-readiness-ui-ux-audit.md) — release checklist alignment
- [phase-1-release-blockers.md](../production-readiness/phase-1-release-blockers.md) — RB-B01, RB-C01 overlap with P0
