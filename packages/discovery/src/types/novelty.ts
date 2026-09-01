import type { ResultLifecycleStatus, ResultState } from './state.js';

/**
 * Deterministic novelty classification (E2.6).
 * Not AI. Not "we saw it in a new Run".
 */
export type NoveltyStatus = 'NEW' | 'UNCHANGED' | 'UPDATED';

/**
 * Pre-persistence decision for E2.7.
 * Does NOT send notifications or write Results.
 */
export type NoveltyDecision = {
  novelty: NoveltyStatus;
  lifecycle: ResultLifecycleStatus;
  userState: ResultState;
  shouldNotify: boolean;
  /** Explainable machine-readable reason */
  reason: string;
  /** Deterministic material field keys that changed (E7) */
  changedFields: string[];
  /** Existing Result id when looked up */
  existingResultId?: string;
};

/**
 * Strategy-owned novelty / notification update policy (E2.6).
 * Engine enforces global safety (dismissed/expired/unchanged never notify).
 */
export type NoveltyPolicy = {
  /**
   * FingerprintMaterial keys used for stable identity lookup across Runs.
   * Typically excludes volatile URL-only keys so source URL churn ≠ new opportunity.
   */
  identityFingerprintFields: string[];
  /**
   * FingerprintMaterial keys that count as material opportunity change when they differ.
   */
  materialFingerprintFields: string[];
  /**
   * Extracted.fields keys compared against persisted materialFields snapshot (E7).
   * Must not overlap identityFingerprintFields (e.g. salary).
   */
  materialExtractedFields?: string[];
  /** Compare title / summary / primaryUrl as material */
  comparePresentation: boolean;
  /** Compare VerificationResult.status as material */
  compareVerificationStatus: boolean;
  /**
   * If set, |ΔmatchScore| or |ΔconfidenceScore| ≥ threshold is material.
   * Omit / undefined → score deltas are ignored for novelty.
   */
  scoreDeltaThreshold?: number;
  /** When true and engine safety allows, UPDATED may notify */
  notifyOnMeaningfulUpdate: boolean;
};
