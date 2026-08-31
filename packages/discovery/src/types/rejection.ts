export type RejectionReasonCode =
  | 'REJECTED_LOCATION'
  | 'REJECTED_SALARY'
  | 'REJECTED_EXCLUDED_ROLE'
  | 'REJECTED_PURCHASE_REQUIRED'
  | 'REJECTED_EXPIRED'
  | 'REJECTED_NO_OFFICIAL_SOURCE'
  | 'REJECTED_LOW_CONFIDENCE'
  | 'REJECTED_DETERMINISTIC_FILTER'
  | 'REJECTED_VERIFICATION_FAIL'
  | 'REJECTED_VERIFICATION_UNKNOWN'
  | 'REJECTED_DUPLICATE'
  | 'REJECTED_SECURITY_POLICY'
  | 'REJECTED_OTHER';

export type CandidateStage =
  | 'DISCOVERED'
  | 'NORMALIZED'
  | 'DEDUPLICATED'
  | 'FILTERED'
  | 'VERIFYING'
  | 'AI_EVALUATING'
  | 'SCORED'
  | 'REJECTED'
  | 'PROMOTED';

export type RejectionRecord = {
  reasonCode: RejectionReasonCode;
  message?: string;
  atStage: CandidateStage;
  at: string;
  details?: Record<string, string | number | boolean | null>;
};
