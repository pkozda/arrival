import type { ModuleExplanation } from './ModuleExplanation.js';

export type RecommendationPriority =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low';

export type Recommendation = {
  id: string;
  title: string;
  description: string;
  priority: RecommendationPriority;
  explanation: ModuleExplanation;
  scopeRef?: string;
};
