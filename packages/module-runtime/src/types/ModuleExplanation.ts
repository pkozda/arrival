export type ExplanationFactor = {
  id: string;
  label: string;
  value: string | number | boolean;
  source: 'profile' | 'input' | 'rule' | 'calculation' | 'default';
  weight?: number;
};

export type ModuleExplanation = {
  summary: string;
  confidence: 'high' | 'medium' | 'low';
  factors: readonly ExplanationFactor[];
  ruleIds?: readonly string[];
};
