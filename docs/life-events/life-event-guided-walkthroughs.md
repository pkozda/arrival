# Life Event Module — Guided demo walkthroughs

Each walkthrough targets **2–3 minutes**. Load the preset from **Header → Life Event demos** (development only), then follow the script.

---

## Walkthrough 1 — Persona A: New Arrival

**Preset:** `new-arrival` (fixture F01)  
**Routes:** Home `/` → Module `/modules/life-event?event=new_arrival`

| Step | Script |
|------|--------|
| Starting situation | “You arrived in Berlin ten days ago and are not yet registered.” |
| Current state | `arrival_unregistered` — **critical** severity |
| Recommended focus | **Complete Anmeldung** |
| Blockers | Set up banking and tax path |
| Next actions | Complete Anmeldung → Understand mandatory health insurance → Set up banking and tax path |
| Outcome | Turns first-week chaos into a single prioritized next step. |

1. Load preset **A — New Arrival**.
2. On Home, show the active plan card and explain this is live planner output—not a static checklist.
3. Open the Life Event module; walk through hero CTA and why registration comes first.
4. Optional: open Scenario Explorer with `new_arrival` to preview “what if” paths.

---

## Walkthrough 2 — Persona B: Job Loss

**Preset:** `job-loss` (fixture F04)  
**Routes:** Home `/` → Module `/modules/life-event?event=job_loss`

| Step | Script |
|------|--------|
| Starting situation | “You lost your job in Munich; rent and insurance still need coverage.” |
| Current state | `economic_setup_pending` — **high** severity |
| Recommended focus | **Stabilize employment situation** |
| Blockers | Clarify income basis; Explore support if income is insufficient |
| Next actions | Stabilize employment → Clarify income → Explore support programs |
| Outcome | Re-prioritizes survival and benefits steps when income stops. |

1. Load preset **B — Job Loss**.
2. Point out how severity and focus shift from the arrival case.
3. Show scenario banner on Home when applicable.
4. Open Explorer at `job_loss` — configure then complete a simulation to show adaptive replanning.

---

## Walkthrough 3 — Persona C: Benefits Discovery

**Preset:** `benefits-discovery` (fixture F08)  
**Routes:** Module `/modules/life-event?event=benefits_trigger`

| Step | Script |
|------|--------|
| Starting situation | “You are employed in Cologne but unsure if housing support applies.” |
| Current state | `benefits_exploration` — **medium** severity |
| Recommended focus | **Identify relevant support programs** |
| Blockers | Understand obligations and trade-offs |
| Next actions | Identify programs → Plan application pathway → Understand trade-offs |
| Outcome | Surfaces Wohngeld and related support without a separate benefits checklist. |

1. Load preset **C — Benefits Discovery**.
2. Emphasize confidence level (**high**) when profile data is complete.
3. Scroll to action breakdown and timeline on the module page.

---

## Walkthrough 4 — Persona D: Stable Resident

**Preset:** `stable-resident` (fixture F10)  
**Routes:** Home `/` → Module `/modules/life-event`

| Step | Script |
|------|--------|
| Starting situation | “You have been in Germany for years; basics are covered.” |
| Current state | `situation_stable` — **low** severity |
| Recommended focus | **Review that your situation is current** |
| Blockers | None active in this preset |
| Next actions | Review situation → Optimize finances → Prepare for life changes |
| Outcome | Keeps long-term residents ahead of transitions instead of only reacting to crises. |

1. Load preset **D — Stable Resident**.
2. Contrast with Persona A—same product, different life state.
3. Show proactive optimization nodes in the timeline.

---

## Suggested presentation order

1. **A — New Arrival** (problem introduction)  
2. **B — Job Loss** (disruption + scenario overlay)  
3. **C — Benefits Discovery** (support awareness)  
4. **D — Stable Resident** (maturity / retention)

Total time: **~10 minutes** including brief Q&A.
