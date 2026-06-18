import type { ModuleUIProjection, SanitizedActionKind, SanitizedActionPriority } from '../ModuleUIProjection.js';

export type ExecutionSnapshot = {
  executionId: string;
  moduleId: string;
  projection: ModuleUIProjection;
  createdAt: string;
};

export type ActionCard = {
  moduleId: string;
  actionId: string;
  label: string;
  description: string;
  priority: SanitizedActionPriority;
  kind: SanitizedActionKind;
};

export type SnapshotRecommendation = {
  moduleId: string;
  recommendationId: string;
  title: string;
  priority?: string;
};

export type ModuleSnapshotSummary = {
  moduleId: string;
  status: 'success' | 'error';
  summary?: string;
  recommendationCount: number;
  actionCount: number;
};

export type UiSnapshotProjection = {
  executions: ExecutionSnapshot[];
  actionCards: ActionCard[];
  recommendations: SnapshotRecommendation[];
  summaries: ModuleSnapshotSummary[];
};

export type SnapshotExecutionInput = {
  moduleId: string;
  executionId: string;
  timestamp: number;
  projection?: ModuleUIProjection;
};
