export type ExecutionState = 'ready' | 'deferred' | 'disabled';

export type ExecutionSource = 'primary' | 'secondary' | 'contextual' | 'blocked';

export type ExecutionUiHint = 'primary' | 'secondary' | 'contextual';

export type ExecutionAction = {
  id: string;
  label: string;
  href?: string;
  sourceNodeId?: string;
  executionState: ExecutionState;
  source: Exclude<ExecutionSource, 'blocked'>;
  uiHint?: ExecutionUiHint;
};

export type ExecutionBlockedAction = {
  id: string;
  label: string;
  href?: string;
  sourceNodeId?: string;
  executionState: 'disabled';
  source: 'blocked';
  uiHint?: ExecutionUiHint;
};

export type ExecutionSurfaceV1 = {
  primary: ExecutionAction | null;
  secondary: ExecutionAction[];
  blocked: ExecutionBlockedAction[];
  contextual: ExecutionAction[];
};

export const EMPTY_EXECUTION_SURFACE: ExecutionSurfaceV1 = {
  primary: null,
  secondary: [],
  blocked: [],
  contextual: [],
};
