export type TaxClass = 1 | 2 | 3 | 4 | 5 | 6;

export type PersonRole = 'applicant' | 'partner' | 'child';

export type EmploymentType = 'none' | 'minijob' | 'midijob' | 'regular' | 'self-employed';

export type RegelbedarfStufe = 'stufe1' | 'stufe2' | 'stufe3' | 'stufe4' | 'stufe5' | 'stufe6';

export type FinancialMode = 'quick' | 'full' | 'compare';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type DecisionPriority = 'critical' | 'high' | 'medium' | 'low';

export interface FinancialPerson {
  id: string;
  role: PersonRole;
  age: number;
  taxClass?: TaxClass;
  churchTax?: boolean;
}

export interface RegularEmployment {
  type: 'regular';
  grossMonthly: number;
  taxClass: TaxClass;
  churchTax?: boolean;
  hoursPerWeek?: number;
}

export interface MinijobEmployment {
  type: 'minijob';
  grossMonthly: number;
  rvOptIn?: boolean;
}

export interface MidijobEmployment {
  type: 'midijob';
  grossMonthly: number;
  taxClass: TaxClass;
  churchTax?: boolean;
}

export interface SelfEmployedEmployment {
  type: 'self-employed';
  netMonthlyEstimate: number;
}

export interface NoEmployment {
  type: 'none';
}

export type Employment =
  | NoEmployment
  | MinijobEmployment
  | MidijobEmployment
  | RegularEmployment
  | SelfEmployedEmployment;

export interface HousingInput {
  coldRent: number;
  utilities: number;
  bundesland: string;
  cityMietstufe?: number;
}

export interface CurrentBenefitsInput {
  receivingBuergergeld?: boolean;
  receivingAlg1?: boolean;
  currentBuergergeldAmount?: number;
}

export interface FinancialScenario {
  id: string;
  label: string;
  employments: Record<string, Employment>;
}

export interface HouseholdInput {
  members: FinancialPerson[];
  housing: HousingInput;
  currentBenefits?: CurrentBenefitsInput;
}

export interface FinancialEngineInput {
  mode: FinancialMode;
  household: HouseholdInput;
  baseline: FinancialScenario;
  proposed?: FinancialScenario;
  taxYear: number;
  ruleSetVersion: string;
  routingWarnings?: string[];
}

export interface PayrollDeductions {
  incomeTax: number;
  solidaritySurcharge: number;
  churchTax: number;
  health: number;
  pension: number;
  unemployment: number;
  care: number;
  socialContributions: number;
}

export interface MemberPayrollResult {
  personId: string;
  role: PersonRole;
  employmentType: EmploymentType;
  gross: number;
  net: number;
  deductions: PayrollDeductions;
  assessmentBase?: number;
}

export interface BuergergeldBreakdown {
  regelbedarf: number;
  kdu: number;
  grossNeed: number;
  grossEmploymentIncome: number;
  freibetragApplied: number;
  countableIncome: number;
  kindergeldIncome: number;
  netBenefit: number;
}

export interface ScenarioResult {
  id: string;
  label: string;
  household: {
    totalGross: number;
    totalNet: number;
    totalDeductions: PayrollDeductions;
    members: MemberPayrollResult[];
  };
  benefits: {
    buergergeld: {
      eligible: boolean;
      estimatedBenefit: number;
      reasoning: string[];
      breakdown: BuergergeldBreakdown;
    };
    kindergeld: number;
  };
  totalHouseholdResources: number;
}

export interface ScenarioComparison {
  baselineId: string;
  proposedId?: string;
  deltaTotalResources: number | null;
  deltaNetEmployment: number | null;
  deltaBuergergeld: number | null;
  effectiveGainFromWork: number | null;
  marginalRetentionRate: number | null;
  benefitReductions: Array<{
    benefit: string;
    before: number;
    after: number;
    delta: number;
  }>;
}

export interface FinancialVerdict {
  isJobFinanciallyBeneficial: boolean | null;
  summary: string;
  householdDeltaMonthly: number | null;
  effectiveGainFromWork: number | null;
  marginalRetentionRate: number | null;
}

export interface FinancialDecision {
  id: string;
  title: string;
  description: string;
  priority: DecisionPriority;
  category: 'employment' | 'benefits' | 'tax' | 'housing' | 'administrative';
  action?: string;
  institution?: string;
}

export interface CalculationTraceStep {
  step: string;
  formula?: string;
  inputs: Record<string, unknown>;
  output: number;
  legalReference?: string;
}

export interface FinancialEngineOutput {
  meta: {
    engineVersion: string;
    taxYear: number;
    ruleSetVersion: string;
    mode: FinancialMode;
    confidence: ConfidenceLevel;
    disclaimer: string;
    calculatedAt: string;
    routingWarnings?: string[];
  };
  verdict: FinancialVerdict;
  scenarios: ScenarioResult[];
  comparison?: ScenarioComparison;
  decisions: FinancialDecision[];
  expectedChanges: Array<{
    trigger: string;
    obligations: string[];
    timeline?: string;
  }>;
  calculationTrace?: CalculationTraceStep[];
}
