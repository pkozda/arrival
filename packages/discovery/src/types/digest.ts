import type { NoveltyStatus } from './novelty.js';
import type { ResultLifecycleStatus, ResultState } from './state.js';

/**
 * Presentation-independent digest entry — references Result ids only.
 * No HTML, source bodies, or UI templates.
 */
export type DigestEntry = {
  resultId: string;
  /** 1-based position after strategy-owned ranking */
  rank: number;
  rankValue: number;
  novelty: NoveltyStatus;
  userState: ResultState;
  lifecycle: ResultLifecycleStatus;
  shouldNotify: boolean;
};

/**
 * Run-scoped digest summary (not historical DB analytics).
 */
export type DigestSummary = {
  totalResults: number;
  newResults: number;
  updatedResults: number;
  unchangedResults: number;
  notifiedResults: number;
};

/** @deprecated Prefer DigestSummary — kept as alias for E1 export compatibility */
export type DiscoverySummary = DigestSummary;

/**
 * Presentation-independent domain Digest (architecture §25 / domain §14).
 */
export type DiscoveryDigest = {
  id: string;
  runId: string;
  profileId: string;
  strategyId: string;
  strategyVersion: string;
  generatedAt: string;
  /** Inclusive run window for audit (startedAt → generatedAt) */
  period: { from: string; to: string };
  resultIds: string[];
  entries: DigestEntry[];
  newResultIds: string[];
  updatedResultIds: string[];
  summary: DigestSummary;
};
