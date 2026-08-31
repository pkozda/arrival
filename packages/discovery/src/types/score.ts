import type { TriState } from './tri-state.js';
import type { AiEvaluation } from './ai-evaluation.js';
import type {
  CandidateIdentity,
  ExtractedFacts,
  SourceRef,
} from './candidate.js';
import type { DiscoveryCriteria } from './criteria.js';
import type { Evidence } from './evidence.js';
import type { VerificationResult } from './verification.js';

export type ScoreDimension = {
  id: string;
  labelKey: string;
  value: number;
  weight: number;
  triStateInputs?: Record<string, TriState>;
};

export type ScoreBreakdown = {
  dimensions: ScoreDimension[];
};

/** Headline scores + strategy-owned breakdown. Ranking formula is NOT fixed in the engine. */
export type Score = {
  /** 0–100 fit to criteria */
  matchScore: number;
  /** 0–100 trustworthiness of conclusion */
  confidenceScore: number;
  breakdown: ScoreBreakdown;
  scoredAt: string;
  strategyVersion: string;
};

export type RankContext = {
  /** e.g. deadline urgency hints from extracted facts */
  novelty?: 'NEW' | 'UPDATED' | 'KNOWN';
  opportunityHints?: Record<string, string | number | boolean | null>;
  /** Optional AI interpretation for strategy-owned rank — never verification */
  aiEvaluation?: AiEvaluation;
};

/**
 * Inputs for strategy-owned score calculation (E2.5).
 * AI is optional; verification is authoritative.
 */
export type ScoreComputationInput = {
  candidate: {
    id: string;
    identity: CandidateIdentity;
    source: SourceRef;
    extracted: ExtractedFacts;
    deterministicFilterPassed: boolean;
  };
  criteria: DiscoveryCriteria;
  verification: VerificationResult;
  evidence: readonly Evidence[];
  aiEvaluation?: AiEvaluation;
  strategyVersion: string;
  scoredAt: string;
};
