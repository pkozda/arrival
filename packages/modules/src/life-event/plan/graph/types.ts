import type {
  LifeActionRef,
  LifeEventNodeCategory,
  LifeEventNodePriority,
  LifeStateId,
} from '@arrival-atlas/product-contract';
import type { SatisfactionKey } from '../signals.js';

export type GraphNodeDefinition = {
  id: string;
  title: string;
  description: string;
  category: LifeEventNodeCategory;
  priority: LifeEventNodePriority;
  phase: number;
  rationale: string;
  satisfactionKey: SatisfactionKey;
  blockedByNodeIds: string[];
  actions: LifeActionRef[];
};

export type LifeEventGraphDefinition = {
  graphId: string;
  lifeStateId: LifeStateId;
  intent: string;
  nodes: GraphNodeDefinition[];
};

export const CATEGORY_RANK: Record<LifeEventNodeCategory, number> = {
  legal: 1,
  survival: 2,
  stabilization: 3,
  optimization: 4,
  life_transition: 5,
};

export const PRIORITY_RANK: Record<LifeEventNodePriority, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};
