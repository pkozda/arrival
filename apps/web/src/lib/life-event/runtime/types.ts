export type ModuleExecutionStatus = 'success' | 'failed' | 'partial';

export type ModuleId = string;

export type ModuleExecutionResultV1 = {
  actionId: string;
  moduleId: ModuleId;
  status: ModuleExecutionStatus;
  metadata?: Record<string, unknown>;
};

export type ModuleRuntimeEventType =
  | 'action_executed'
  | 'module_completed'
  | 'module_failed'
  | 'state_change';

export type ModuleRuntimeEventV1 = {
  type: ModuleRuntimeEventType;
  execution: ModuleExecutionResultV1;
  occurredAt: string;
};

export type CrossModuleSignalType =
  | 'completion_signal'
  | 'dependency_unlocked'
  | 'partial_resolution'
  | 'regression_detected'
  | 'stabilization_hint';

export type CrossModuleSignalV1 = {
  signalType: CrossModuleSignalType;
  sourceModuleId: ModuleId;
  targetModuleId?: ModuleId;
  actionId: string;
  message: string;
  advisoryOnly: true;
};

export type ModuleStateMutationType = 'completed' | 'failed' | 'partial' | 'retry_required';

export type ModuleStateMutationV1 = {
  moduleId: ModuleId;
  mutationType: ModuleStateMutationType;
  actionId: string;
};

export type RuntimeActionEffectV1 = {
  completedActions: string[];
  failedActions: string[];
  stateSignals: CrossModuleSignalV1[];
  moduleMutations: ModuleStateMutationV1[];
};

export type RuntimeSessionState = {
  lastExecutedActions: string[];
  moduleCompletionFlags: Record<ModuleId, boolean>;
  transientEffects: RuntimeActionEffectV1[];
};

export type PartialRuntimeEffect = Partial<RuntimeActionEffectV1>;

export type ModuleRuntimeHandlerContext = {
  event: ModuleRuntimeEventV1;
  session: RuntimeSessionState;
};

export type ModuleRuntimeHandler = {
  onActionExecuted?: (context: ModuleRuntimeHandlerContext) => PartialRuntimeEffect;
  onModuleCompleted?: (context: ModuleRuntimeHandlerContext) => PartialRuntimeEffect;
  onModuleFailed?: (context: ModuleRuntimeHandlerContext) => PartialRuntimeEffect;
  onStateChange?: (context: ModuleRuntimeHandlerContext) => PartialRuntimeEffect;
};
