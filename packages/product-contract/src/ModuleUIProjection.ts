export type SanitizedRecommendationPriority = 'critical' | 'high' | 'medium' | 'low';

export type SanitizedRecommendation = {
  title: string;
  description: string;
  priority: SanitizedRecommendationPriority;
  reason?: string;
};

export type SanitizedActionKind =
  | 'apply'
  | 'contact'
  | 'collect-documents'
  | 'schedule'
  | 'custom';

export type SanitizedActionPriority = 'high' | 'medium' | 'low';

export type SanitizedAction = {
  label: string;
  description: string;
  priority: SanitizedActionPriority;
  kind: SanitizedActionKind;
};

export type SanitizedExplanation = {
  summary: string;
  confidence: 'high' | 'medium' | 'low';
  reasons: readonly string[];
};

/** Product-level terminal outcomes for module execution (PD-003 Healthcare). */
export type ModuleExecutionOutcome =
  | 'RECOMMENDATIONS'
  | 'MORE_INFO_REQUIRED'
  | 'NO_APPLICABLE_RESULT'
  | 'TECHNICAL_ERROR';

export type ModuleMissingContext = {
  field: string;
  reasonKey: string;
  profileHref?: string;
};

export type ModuleUIProjection = {
  moduleId: string;
  title: string;
  status: 'success' | 'error';
  summary?: string;
  recommendations: readonly SanitizedRecommendation[];
  actions: readonly SanitizedAction[];
  explanation?: SanitizedExplanation;
  /** Explicit terminal outcome — distinguishes intentional empties from projection gaps. */
  outcome?: ModuleExecutionOutcome;
  missingContext?: readonly ModuleMissingContext[];
  insuranceAssumption?: 'insured' | 'uninsured' | 'unknown';
  error?: {
    message: string;
    code?: string;
  };
};

export type ModuleExecuteMeta = {
  executionId: string;
  duration: number;
};

export type ModuleExecuteProjectionResponse = {
  projection: ModuleUIProjection;
  meta?: ModuleExecuteMeta;
};
