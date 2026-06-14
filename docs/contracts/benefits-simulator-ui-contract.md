# Benefits Simulator — UI Contract

**Module:** `benefits-simulator`  
**Output schema version:** `1.0.0` (`meta.schemaVersion`)  
**Status:** Contract reference (non-functional)  
**Audience:** Web client implementers

---

## Purpose

This document defines how the Benefits Simulator API response must be rendered in the UI. It does not prescribe components or styling — only data binding, ordering, and severity mapping rules.

---

## Response Shape

The UI consumes the output of `POST /api/modules/benefits-simulator/execute` after profile merge via `resolveExecutionContext()`.

```typescript
{
  meta: { schemaVersion, engineVersion, taxYear, ruleSetVersion, confidence, disclaimer, calculatedAt, scenarioCount },
  baseline: ScenarioSummary,
  scenarios: ScenarioSummary[],
  comparison: ComparisonSummary,
  riskWarnings: RiskWarning[],
  recommendations: Recommendation[],
  summary: string
}
```

---

## Required Fields for UI

### Always render

| Field | UI use |
|-------|--------|
| `meta.disclaimer` | Persistent footer or banner — never hidden |
| `meta.confidence` | Badge: high / medium / low |
| `meta.schemaVersion` | Client compatibility check |
| `summary` | Hero summary sentence at top of results |
| `baseline` | First row in scenario comparison table |
| `scenarios[]` | Subsequent rows — one per modeled change |
| `comparison.spread` | Highlight financial range across scenarios |

### Render when present

| Field | Condition |
|-------|-----------|
| `riskWarnings[]` | Always show section; empty state: "No critical risks detected" |
| `recommendations[]` | Show when length > 0 |
| `comparison.bestScenarioId` | Highlight matching scenario row |
| `comparison.worstScenarioId` | Optional de-emphasis or warning styling |

### Do not render from engine internals

| Excluded | Reason |
|----------|--------|
| `profileSlice`, `trace`, `mergedInput` | Backend-only |
| Raw `AppContext` | Not in module output |

---

## Scenario Table Rendering

### Row order (strict)

1. **Baseline** — `baseline` object (id is always `baseline`)
2. **Scenarios** — `scenarios[]` in **API response order** (matches input `scenarios[]` order)

Do not re-sort scenarios by `totalHouseholdResources` unless user explicitly toggles sort. Default order preserves user-defined exploration sequence.

### Columns (recommended)

| Column | Source field |
|--------|--------------|
| Scenario name | `label` |
| Events | `eventsApplied[]` joined (e.g. `minijob`, `rent-change`) |
| Gross income | `financialImpact.totalGross` |
| Net income | `financialImpact.totalNet` |
| Household resources | `financialImpact.totalHouseholdResources` |
| Δ vs baseline | `financialImpact.deltaFromBaseline` |
| Bürgergeld Δ | `benefitChanges.buergergeld.delta` |
| Kindergeld Δ | `benefitChanges.kindergeld.delta` |
| Gain from work | `effectiveGainFromWork` (nullable) |
| Retention rate | `marginalRetentionRate` (nullable, show as %) |

### Baseline row styling

- Label: "Current situation" (from `baseline.label`)
- `eventsApplied` is `["baseline"]` — show as "—" or "Current"
- `deltaFromBaseline` is always `0`

### Best / worst highlighting

| Condition | UI treatment |
|-----------|--------------|
| `scenario.id === comparison.bestScenarioId` | Success accent + "Best option" chip |
| `scenario.id === comparison.worstScenarioId` | Warning accent |
| `comparison.spread === 0` | Hide best/worst chips; show "No material difference" |

---

## Risk Warnings Panel

### Ordering

1. `critical` severity first
2. Then `high`, `medium`, `low`
3. Within same severity: `legal` → `financial` → `benefits` → `housing` → `employment`

### Severity mapping

| `severity` | UI token | Color intent |
|------------|----------|--------------|
| `critical` | `risk-critical` | Red — blocking decision risk |
| `high` | `risk-high` | Orange — action required |
| `medium` | `risk-medium` | Amber — review recommended |
| `low` | `risk-low` | Gray — informational |

### Required display per warning

| Field | Required |
|-------|----------|
| `title` | Yes |
| `description` | Yes |
| `category` | Yes (icon or label) |
| `action` | Show as CTA when present |
| `institution` | Show as subtitle when present (e.g. Jobcenter) |

### Category icons (suggested)

| `category` | Label |
|------------|-------|
| `legal` | Legal obligation |
| `financial` | Financial risk |
| `benefits` | Benefit change |
| `housing` | Housing cost |
| `employment` | Employment impact |

---

## Recommendations Panel

### Ordering

1. `critical` priority
2. `high`, `medium`, `low`
3. Within priority: recommendations with `scenarioId` matching `comparison.bestScenarioId` first

### Display rules

| Field | UI use |
|-------|--------|
| `title` | Card heading |
| `description` | Body text |
| `rationale` | Collapsible detail or tooltip |
| `scenarioId` | Link to scenario row when set |

---

## Confidence Badge

| `meta.confidence` | User-facing copy |
|-------------------|------------------|
| `high` | "High confidence estimate" |
| `medium` | "Directional estimate — verify with advisor" |
| `low` | "Low confidence — more profile data needed" |

Show `meta.confidence` adjacent to `meta.disclaimer`.

---

## Schema Versioning

| `meta.schemaVersion` | Client behavior |
|----------------------|-----------------|
| `1.0.0` | Full render per this contract |
| Unknown | Render known fields; log warning; do not crash |

Clients should treat unknown `schemaVersion` as forward-compatible if all required fields above are present.

---

## Empty & Edge States

| State | UI behavior |
|-------|-------------|
| `scenarios.length === 0` | Should not occur (Zod min 1); show error |
| `riskWarnings.length === 0` | Show neutral "No warnings" state |
| `recommendations.length === 0` | Hide recommendations section |
| `effectiveGainFromWork === null` | Show "—" in gain column |
| `marginalRetentionRate === null` | Show "—" in retention column |

---

## Accessibility

- Scenario table must have row headers (`<th scope="row">`) for scenario names
- Risk severity must not rely on color alone — include text label
- `meta.disclaimer` must be readable by screen readers (not `aria-hidden`)

---

## Related Documents

- `docs/audits/benefits-simulator-design.md` — product design
- `docs/audits/benefits-simulator-implementation-plan.md` — architecture
- `tests/fixtures/benefits-simulator-scenarios.json` — golden scenario inputs
