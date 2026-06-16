import type { UiSnapshot, UxPayload } from '@/lib/api';

export type ModuleUIStatus = 'idle' | 'executed' | 'partial';

export type ModuleExecutionView = UiSnapshot['executions'][number];

export type ModuleUIState = {
  input: Record<string, unknown>;
  result: unknown | null;
  ux: UxPayload | null;
  status: ModuleUIStatus;
  executionId: string | null;
  snapshotVersion: number;
};

export type SnapshotReconstruction = ModuleUIState & {
  isStale: boolean;
};
