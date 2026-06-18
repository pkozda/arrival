import type { RecommendationPriority } from './Recommendation.js';

export type ActionKind =
  | 'apply'
  | 'contact'
  | 'collect-documents'
  | 'schedule'
  | 'custom';

export type ActionPriority = Extract<RecommendationPriority, 'high' | 'medium' | 'low'>;

export type ActionItem = {
  id: string;
  kind: ActionKind;
  title: string;
  description: string;
  priority: ActionPriority;
  target?: string;
  recommendationId?: string;
};
