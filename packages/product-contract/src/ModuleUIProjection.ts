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

export type ModuleUIProjection = {
  moduleId: string;
  title: string;
  status: 'success' | 'error';
  summary?: string;
  recommendations: readonly SanitizedRecommendation[];
  actions: readonly SanitizedAction[];
  explanation?: SanitizedExplanation;
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
