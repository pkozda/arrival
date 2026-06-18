export type ExplanationFactorType = 'input' | 'rule' | 'context' | 'system';

export type ExplanationFactor = {
  id: string;
  label: string;
  type: ExplanationFactorType;
  weight?: number;
};

export type ExplanationConfidence = 'low' | 'medium' | 'high';

export type ModuleExplanationView = {
  moduleId: string;
  executionId: string;
  confidence: ExplanationConfidence;
  triggeredBecause: ExplanationFactor[];
  recommendations: Array<{
    recommendationId: string;
    because: ExplanationFactor[];
  }>;
  actions: Array<{
    actionId: string;
    because: ExplanationFactor[];
  }>;
};
