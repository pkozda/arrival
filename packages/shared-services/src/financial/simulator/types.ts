import type {
  Employment,
  HouseholdInput,
  ScenarioComparison,
  ScenarioResult,
  ConfidenceLevel,
} from '../types/index.js';

export type SimulatorEvent =
  | { type: 'unemployment'; memberId?: string }
  | {
      type: 'employment';
      memberId?: string;
      grossMonthly: number;
      taxClass: 1 | 2 | 3 | 4 | 5 | 6;
      churchTax?: boolean;
      hoursPerWeek?: number;
    }
  | {
      type: 'part-time-employment';
      memberId?: string;
      grossMonthly: number;
      taxClass: 1 | 2 | 3 | 4 | 5 | 6;
      churchTax?: boolean;
      hoursPerWeek: number;
    }
  | {
      type: 'minijob';
      memberId?: string;
      grossMonthly: number;
      rvOptIn?: boolean;
    }
  | {
      type: 'midijob';
      memberId?: string;
      grossMonthly: number;
      taxClass: 1 | 2 | 3 | 4 | 5 | 6;
      churchTax?: boolean;
    }
  | { type: 'child-added'; age: number }
  | { type: 'child-removed'; childIndex: number }
  | {
      type: 'household-composition';
      maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
      children: Array<{ age: number }>;
    }
  | { type: 'rent-change'; newColdRent: number; newUtilities?: number }
  | { type: 'partner-employment-change'; employment: Employment };

export interface SimulatorBaselineState {
  household: HouseholdInput;
  employments: Record<string, Employment>;
}

export interface SimulatorScenarioDefinition {
  id: string;
  label: string;
  events: SimulatorEvent[];
}

export interface SimulatorGridInput {
  taxYear: number;
  baseline: SimulatorBaselineState & { label: string };
  scenarios: SimulatorScenarioDefinition[];
  receivingBuergergeld?: boolean;
}

export interface SimulatorRiskWarning {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  category: 'benefits' | 'employment' | 'housing' | 'legal' | 'financial';
  action?: string;
  institution?: string;
}

export interface SimulatorRecommendation {
  id: string;
  scenarioId?: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  rationale: string;
}

export interface SimulatorComparisonSummary {
  bestScenarioId: string | null;
  worstScenarioId: string | null;
  maxHouseholdResources: number;
  minHouseholdResources: number;
  spread: number;
}

export interface SimulatorGridOutput {
  meta: {
    engineVersion: string;
    taxYear: number;
    ruleSetVersion: string;
    confidence: ConfidenceLevel;
    disclaimer: string;
    calculatedAt: string;
    scenarioCount: number;
  };
  baseline: ScenarioResult;
  scenarios: ScenarioResult[];
  comparisons: ScenarioComparison[];
  comparisonSummary: SimulatorComparisonSummary;
  riskWarnings: SimulatorRiskWarning[];
  recommendations: SimulatorRecommendation[];
  summary: string;
}
