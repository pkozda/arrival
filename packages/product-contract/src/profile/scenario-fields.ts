import { z } from 'zod';

/**
 * Scenario-only field identifiers — MUST NOT appear in ProfileState / persistent payloads.
 * Module execution input only; excluded from mutation commit contracts.
 */
export const SCENARIO_FIELD_IDS = [
  'proposedGrossIncome',
  'proposedRent',
  'whatIfHouseholdSize',
  'scenarioComparisonMode',
  'whatIfTaxClass',
] as const;

export const ScenarioFieldIdSchema = z.enum(SCENARIO_FIELD_IDS);

export type ScenarioFieldId = z.infer<typeof ScenarioFieldIdSchema>;

export type ScenarioFieldDefinition = {
  id: ScenarioFieldId;
  description: string;
};

export const SCENARIO_FIELD_REGISTRY: Readonly<Record<ScenarioFieldId, ScenarioFieldDefinition>> = {
  proposedGrossIncome: {
    id: 'proposedGrossIncome',
    description: 'Hypothetical gross income for what-if module runs',
  },
  proposedRent: {
    id: 'proposedRent',
    description: 'Hypothetical rent for scenario comparison',
  },
  whatIfHouseholdSize: {
    id: 'whatIfHouseholdSize',
    description: 'Hypothetical household size for scenario runs',
  },
  scenarioComparisonMode: {
    id: 'scenarioComparisonMode',
    description: 'Module UI comparison mode toggle',
  },
  whatIfTaxClass: {
    id: 'whatIfTaxClass',
    description: 'Hypothetical tax class for scenario runs',
  },
};

export function isScenarioFieldId(value: unknown): value is ScenarioFieldId {
  return ScenarioFieldIdSchema.safeParse(value).success;
}

/** Branded marker — values keyed by ScenarioFieldId must never enter persistent fact payloads. */
export type ScenarioFieldValueMap = Partial<Record<ScenarioFieldId, unknown>>;
