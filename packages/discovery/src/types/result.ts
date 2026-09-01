import type { CandidateIdentity, SourceRef } from './candidate.js';
import type { Evidence } from './evidence.js';
import type { Score } from './score.js';
import type { ResultLifecycleStatus, ResultState } from './state.js';
import type { VerificationResult } from './verification.js';

export type ResultPresentation = {
  title: string;
  summary?: string;
  primaryUrl?: string;
};

export type DiscoveryResult = {
  id: string;
  profileId: string;
  strategyId: string;
  strategyVersion: string;
  identity: CandidateIdentity;
  canonicalPresentation: ResultPresentation;
  source: SourceRef;
  verification: VerificationResult;
  evidence: Evidence[];
  score: Score;
  lifecycle: ResultLifecycleStatus;
  userState: ResultState;
  firstSeenAt: string;
  lastVerifiedAt: string;
  lastChangedAt: string;
  promotedFromCandidateId?: string;
  promotedFromRunId?: string;
  /**
   * Snapshot of material extracted fields at last promote (E7).
   * Not part of identity — used for field-level change detection.
   */
  materialFields?: Record<string, string | number | boolean | null>;
  /**
   * Field paths that changed on the last material update (E7.5).
   * Empty for NEW and UNCHANGED promotions.
   */
  changedFields?: string[];
};
