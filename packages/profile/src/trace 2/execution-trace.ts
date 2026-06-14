export type ExecutionTrace = {
  sessionId: string;
  moduleId: string;
  steps: ExecutionTraceStep[];
};

export type ExecutionTraceStep =
  | { type: 'PROFILE_LOADED'; profileId: string }
  | { type: 'POLICY_APPLIED'; policyId: string }
  | { type: 'FIELD_ALLOWED'; field: string }
  | { type: 'FIELD_REDACTED'; field: string }
  | { type: 'INPUT_OVERRIDE'; field: string; value: unknown }
  | {
      type: 'MERGE_DECISION';
      field: string;
      source: 'profile' | 'input' | 'default';
    }
  | { type: 'FINAL_VALUE'; field: string; value: unknown };
