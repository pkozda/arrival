import type { ActionItem } from './ActionItem.js';
import type { ModuleExplanation } from './ModuleExplanation.js';
import type { Recommendation } from './Recommendation.js';

export type ModuleResultStatus =
  | 'success'
  | 'validation_error'
  | 'execution_error';

export type ModuleResultMeta = {
  moduleId: string;
  moduleVersion: string;
  runtimeContractVersion: '1.0';
  executionId: string;
  executedAt: string;
  confidence: 'high' | 'medium' | 'low';
  disclaimer?: string;
};

export type ModuleResult<TPayload = unknown> = {
  status: ModuleResultStatus;
  meta: ModuleResultMeta;
  payload?: TPayload;
  recommendations?: readonly Recommendation[];
  actions?: readonly ActionItem[];
  explanation?: ModuleExplanation;
  error?: string;
};
