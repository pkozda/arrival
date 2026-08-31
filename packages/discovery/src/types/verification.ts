import type { TriState } from './tri-state.js';
import type { SourceTrust } from './candidate.js';

export type VerificationStatus = 'PASS' | 'FAIL' | 'UNKNOWN';

export type FreshnessStatus = 'CURRENT' | 'STALE' | 'EXPIRED' | 'UNKNOWN';

export type VerificationCheck = {
  id: string;
  outcome: TriState;
  required: boolean;
  detail?: string;
  evidenceIds?: string[];
};

export type VerificationResult = {
  status: VerificationStatus;
  sourceTrust: SourceTrust;
  freshness: FreshnessStatus;
  checks: VerificationCheck[];
  verifiedAt: string;
  evidenceIds: string[];
};
