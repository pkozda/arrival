/**
 * Global engine invariants (ADR-006). Strategies must not weaken these.
 */
export type EnginePolicy = {
  /** Candidate cannot become Result without required verification when strategy requires PASS */
  enforceFoundNotVerified: true;
  /** AI cannot fabricate Evidence */
  aiCannotFabricateEvidence: true;
  /** External page content is untrusted input */
  externalContentUntrusted: true;
  /** UNKNOWN must never be coerced to passing booleans */
  forbidUnknownCoercion: true;
  /**
   * Engine-level AI kill switch.
   * When false, AI adapter is never invoked (distinct from strategy.aiEvaluationPolicy.enabled).
   */
  aiEnabled: boolean;
  /**
   * Max AI evaluations per DiscoveryRun.
   * 0 = budget exhausted / no AI calls. Count gate for cost-aware AI (roadmap E6).
   */
  maxAiEvaluationsPerRun: number;
  /**
   * Optional estimated input-token budget per DiscoveryRun.
   * Deterministic estimate only — not provider billing. Undefined = unlimited.
   */
  maxEstimatedAiInputTokensPerRun?: number;
  /**
   * Optional estimated output-token budget per DiscoveryRun.
   * Deterministic estimate only — not provider billing. Undefined = unlimited.
   */
  maxEstimatedAiOutputTokensPerRun?: number;
};

export const DEFAULT_ENGINE_POLICY: EnginePolicy = {
  enforceFoundNotVerified: true,
  aiCannotFabricateEvidence: true,
  externalContentUntrusted: true,
  forbidUnknownCoercion: true,
  aiEnabled: true,
  maxAiEvaluationsPerRun: 100,
};
