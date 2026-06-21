# Life Event screenshot capture guide

Screenshots for PH-4 live under this folder. Each asset is a lightweight wireframe placeholder until replaced with a live capture from `npm run dev`.

## Capture environment

1. Start the stack: `npm run dev` (API on `:3001`, web on `:3000`).
2. Open the header menu → **Life Event demos** → load the preset noted below.
3. Use a 1280×800 viewport for desktop and 390×844 for mobile (iPhone 14).
4. Save PNGs alongside the SVG placeholders using the same basename (`.png`).

## Required shots

| File | Preset | Route | Notes |
|------|--------|-------|-------|
| `home-active-plan` | `new-arrival` | `/` | Home with life-event plan card visible |
| `home-scenario-banner` | `job-loss` | `/` | Scenario overlay banner on Home |
| `home-localized-de` | `new-arrival` | `/` | Switch language to **DE** before capture |
| `module-hero` | `new-arrival` | `/modules/life-event` | Hero + primary CTA |
| `module-action-breakdown` | `job-loss` | `/modules/life-event` | Action breakdown section |
| `module-timeline` | `benefits-discovery` | `/modules/life-event` | Timeline lane |
| `explorer-configured` | `job-loss` | `/modules/life-event?event=job_loss#explorer` | Scenario configured, not submitted |
| `explorer-completed` | `job-loss` | same + submit simulation | After explorer submit |
| `mobile-home` | `new-arrival` | `/` @ 390px | Mobile Home |
| `mobile-module` | `new-arrival` | `/modules/life-event` @ 390px | Mobile module page |

Replace SVG placeholders with PNG when captured; update `life-event-showcase-gallery.md` image extensions if needed.
