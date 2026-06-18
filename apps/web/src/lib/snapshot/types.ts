import type { ModuleUIProjection } from '@/lib/product-contract';

export type ModuleUIStatus = 'idle' | 'executed' | 'partial';

export type ModuleExecutionView = {
  moduleId: string;
  projection: ModuleUIProjection;
  createdAt: string;
  executionId: string;
};

export type ModuleUIState = {
  projection: ModuleUIProjection | null;
  status: ModuleUIStatus;
  executionId: string | null;
  snapshotVersion: number;
};

export type SnapshotReconstruction = ModuleUIState & {
  isStale: boolean;
};
