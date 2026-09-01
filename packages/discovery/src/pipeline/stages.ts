import type { PipelineBatch, PipelineContext, StageDiagnostic } from './types.js';
import { withActive } from './types.js';
import { stageDiagnostic, stubStageDiagnostic } from './diagnostics.js';
import { rawToCandidate, fingerprintKey } from './candidate-factory.js';
import { AdapterError, PartialSearchError, toAdapterContext } from './adapters.js';
import { AdapterFailureError, adapterFailureReasonCode } from '../adapter-infra/index.js';
import type { DiscoveryCandidate } from '../types/candidate.js';
import { finalizeVerificationResult } from './verification-integrity.js';
import { evaluateAiGate, validateAiEvaluation } from './ai-gate.js';
import {
  estimateReservedOutputTokens,
  estimateTokensFromStructuredPayload,
} from './ai-cost.js';
import {
  buildAiAccountingPayload,
  computeAiEvaluationFingerprint,
} from './ai-fingerprint.js';
import { validateScore } from '../invariants/score.js';
import type { AiEvaluation } from '../types/ai-evaluation.js';
import type { RankContext } from '../types/score.js';
import {
  decideNovelty,
  presentationFromCandidate,
} from './novelty-decision.js';
import { ResultStoreError } from './result-store.js';
import { ResultWriterError } from './result-writer.js';
import { buildPersistPlan } from './persist-plan.js';
import { canPromote } from '../invariants/promotion.js';
import { toStrategyDescriptor } from '../types/strategy.js';
import {
  buildDiscoveryDigest,
  type DigestCandidateSource,
} from './digest-builder.js';

export type StageExecution = {
  batch: PipelineBatch;
  context: PipelineContext;
  diagnostics: StageDiagnostic[];
  /** Non-fatal adapter/stage errors that may yield PARTIAL_SUCCESS */
  partialFailures: string[];
};

export async function runBuildQueriesStage(
  batch: PipelineBatch,
  context: PipelineContext
): Promise<StageExecution> {
  const started = Date.now();
  const queries = context.strategy.buildQueries(context.run.criteriaSnapshot);
  const nextContext: PipelineContext = {
    ...context,
    queries: [...queries],
  };
  return {
    batch,
    context: nextContext,
    diagnostics: [
      stageDiagnostic({
        runId: context.run.id,
        stage: 'build_queries',
        startedAtMs: started,
        outcome: 'ok',
        message: `Built ${queries.length} quer${queries.length === 1 ? 'y' : 'ies'}`,
      }),
    ],
    partialFailures: [],
  };
}

export async function runSearchStage(
  batch: PipelineBatch,
  context: PipelineContext
): Promise<StageExecution> {
  const started = Date.now();
  const search = context.adapters.search;
  if (!search) {
    return {
      batch,
      context,
      diagnostics: [
        stubStageDiagnostic(
          context.run.id,
          'search',
          started,
          'SearchAdapter not supplied — no candidates discovered'
        ),
      ],
      partialFailures: [],
    };
  }

  try {
    const raws = await search.search(
      context.queries,
      toAdapterContext({
        run: context.run,
        now: context.now,
        signal: context.signal,
        adapterTimeoutMs: context.adapterTimeoutMs,
      })
    );
    return finishSearch(batch, context, raws, started, []);
  } catch (err) {
    if (err instanceof PartialSearchError) {
      return finishSearch(batch, context, err.results, started, err.failures);
    }
    if (AdapterFailureError.isAdapterFailure(err)) {
      return {
        batch,
        context,
        diagnostics: [
          stageDiagnostic({
            runId: context.run.id,
            stage: 'search',
            startedAtMs: started,
            outcome: 'error',
            adapter: 'search',
            operation: err.operation,
            reasonCode: adapterFailureReasonCode(err.failure.code),
            message: err.message,
          }),
        ],
        partialFailures: [`search:${err.failure.code}:${err.message}`],
      };
    }
    const message =
      err instanceof AdapterError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Search adapter failed';
    return {
      batch,
      context,
      diagnostics: [
        stageDiagnostic({
          runId: context.run.id,
          stage: 'search',
          startedAtMs: started,
          outcome: 'partial',
          adapter: 'search',
          reasonCode: 'ADAPTER_FAILURE',
          message,
        }),
      ],
      partialFailures: [`search:${message}`],
    };
  }
}

function finishSearch(
  batch: PipelineBatch,
  context: PipelineContext,
  raws: import('../types/candidate.js').RawCandidatePayload[],
  started: number,
  failures: string[]
): StageExecution {
  const discoveredAt = context.now();
  const candidates = raws.map((raw, index) =>
    rawToCandidate(raw, context.run.id, index, discoveredAt)
  );
  const nextBatch = appendDiscovered(batch, candidates);
  const nextRun = {
    ...context.run,
    stats: {
      ...context.run.stats,
      candidatesFound: context.run.stats.candidatesFound + candidates.length,
    },
  };
  return {
    batch: nextBatch,
    context: { ...context, run: nextRun },
    diagnostics: [
      stageDiagnostic({
        runId: context.run.id,
        stage: 'search',
        startedAtMs: started,
        outcome: failures.length > 0 ? 'partial' : 'ok',
        adapter: 'search',
        message:
          failures.length > 0
            ? `Discovered ${candidates.length} candidate(s) with partial failures`
            : `Discovered ${candidates.length} candidate(s)`,
      }),
    ],
    partialFailures: failures.map((f) => `search:${f}`),
  };
}

function appendDiscovered(
  batch: PipelineBatch,
  candidates: DiscoveryCandidate[]
): PipelineBatch {
  return {
    active: [...batch.active, ...candidates],
    rejected: [...batch.rejected],
  };
}

/**
 * Collect / Fetch — populates `raw` refs via FetchAdapter.
 * Candidate-level failures → rejected with REJECTED_OTHER + FETCH_FAILED detail.
 * Missing adapter → explicit stub (does not invent successful collection).
 */
export async function runCollectStage(
  batch: PipelineBatch,
  context: PipelineContext
): Promise<StageExecution> {
  const started = Date.now();
  const fetch = context.adapters.fetch;
  if (!fetch) {
    return {
      batch,
      context,
      diagnostics: [
        stubStageDiagnostic(
          context.run.id,
          'collect',
          started,
          'FetchAdapter not supplied — collection skipped (explicit stub)'
        ),
      ],
      partialFailures: [],
    };
  }

  const diagnostics: StageDiagnostic[] = [];
  const partialFailures: string[] = [];
  let next: PipelineBatch = { active: [], rejected: [...batch.rejected] };
  let fetchRejects = 0;

  for (const candidate of batch.active) {
    const url = candidate.identity.canonicalUrl;
    if (!url) {
      next = {
        active: [...next.active, { ...candidate }],
        rejected: [...next.rejected],
      };
      diagnostics.push(
        stageDiagnostic({
          runId: context.run.id,
          stage: 'collect',
          candidateId: candidate.id,
          startedAtMs: started,
          outcome: 'ok',
          adapter: 'fetch',
          message: 'No canonicalUrl — fetch skipped',
        })
      );
      continue;
    }

    const candStarted = Date.now();
    try {
      const result = await fetch.fetch(
        { url, candidateId: candidate.id },
        toAdapterContext({
          run: context.run,
          now: context.now,
          signal: context.signal,
          adapterTimeoutMs: context.adapterTimeoutMs,
        })
      );
      if (!result.ok) {
        fetchRejects += 1;
        const failureTag = result.failureCode ?? result.reasonCode;
        const rejection = {
          reasonCode: 'REJECTED_OTHER' as const,
          message: result.message,
          atStage: 'DISCOVERED' as const,
          at: context.now(),
          details: {
            failure: failureTag,
            sourceUrl: result.sourceUrl ?? url,
          },
        };
        const rejectedCandidate: DiscoveryCandidate = {
          ...candidate,
          stage: 'REJECTED',
          rejection,
        };
        next = {
          active: [...next.active],
          rejected: [
            ...next.rejected,
            { candidate: rejectedCandidate, rejection },
          ],
        };
        partialFailures.push(`fetch:${candidate.id}:${failureTag}:${result.message}`);
        diagnostics.push(
          stageDiagnostic({
            runId: context.run.id,
            stage: 'collect',
            candidateId: candidate.id,
            startedAtMs: candStarted,
            outcome: 'reject',
            adapter: 'fetch',
            operation: 'http_get',
            reasonCode: result.reasonCode,
            message: result.message,
          })
        );
        continue;
      }

      const nextCandidate: DiscoveryCandidate = {
        ...candidate,
        raw: { ...result.content },
      };
      next = {
        active: [...next.active, nextCandidate],
        rejected: [...next.rejected],
      };
      diagnostics.push(
        stageDiagnostic({
          runId: context.run.id,
          stage: 'collect',
          candidateId: candidate.id,
          startedAtMs: candStarted,
          outcome: 'ok',
          adapter: 'fetch',
          message: `Fetched ${result.sourceUrl}`,
        })
      );
    } catch (err) {
      fetchRejects += 1;
      const message =
        err instanceof AdapterError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Fetch adapter threw';
      const rejection = {
        reasonCode: 'REJECTED_OTHER' as const,
        message,
        atStage: 'DISCOVERED' as const,
        at: context.now(),
        details: { failure: 'FETCH_FAILED', sourceUrl: url },
      };
      const rejectedCandidate: DiscoveryCandidate = {
        ...candidate,
        stage: 'REJECTED',
        rejection,
      };
      next = {
        active: [...next.active],
        rejected: [
          ...next.rejected,
          { candidate: rejectedCandidate, rejection },
        ],
      };
      partialFailures.push(`fetch:${candidate.id}:${message}`);
      diagnostics.push(
        stageDiagnostic({
          runId: context.run.id,
          stage: 'collect',
          candidateId: candidate.id,
          startedAtMs: candStarted,
          outcome: 'reject',
          adapter: 'fetch',
          reasonCode: 'FETCH_FAILED',
          message,
        })
      );
    }
  }

  const nextRun = {
    ...context.run,
    stats: {
      ...context.run.stats,
      candidatesRejected: context.run.stats.candidatesRejected + fetchRejects,
    },
  };

  diagnostics.unshift(
    stageDiagnostic({
      runId: context.run.id,
      stage: 'collect',
      startedAtMs: started,
      outcome: fetchRejects > 0 ? 'partial' : 'ok',
      adapter: 'fetch',
      message: `Collect complete; ${fetchRejects} fetch failure(s)`,
    })
  );

  return {
    batch: next,
    context: { ...context, run: nextRun },
    diagnostics,
    partialFailures,
  };
}

/**
 * Parse — ContentExtractor → ExtractedFacts only.
 * Never creates Evidence or VerificationResult.
 */
export async function runParseStage(
  batch: PipelineBatch,
  context: PipelineContext
): Promise<StageExecution> {
  const started = Date.now();
  const extract = context.adapters.extract;
  if (!extract) {
    return {
      batch,
      context,
      diagnostics: [
        stubStageDiagnostic(
          context.run.id,
          'parse',
          started,
          'ContentExtractor not supplied — parse skipped (explicit stub)'
        ),
      ],
      partialFailures: [],
    };
  }

  const diagnostics: StageDiagnostic[] = [];
  const partialFailures: string[] = [];
  let next: PipelineBatch = { active: [], rejected: [...batch.rejected] };
  let parseRejects = 0;

  for (const candidate of batch.active) {
    const candStarted = Date.now();
    try {
      const result = await extract.extract(candidate.raw, {
        run: context.run,
        candidateId: candidate.id,
        now: context.now,
        signal: context.signal,
        timeoutMs: context.adapterTimeoutMs,
      });
      if (!result.ok) {
        parseRejects += 1;
        const rejection = {
          reasonCode: 'REJECTED_OTHER' as const,
          message: result.message,
          atStage: 'DISCOVERED' as const,
          at: context.now(),
          details: { failure: 'PARSE_FAILED', rawRef: candidate.raw.ref },
        };
        const rejectedCandidate: DiscoveryCandidate = {
          ...candidate,
          stage: 'REJECTED',
          rejection,
        };
        next = {
          active: [...next.active],
          rejected: [
            ...next.rejected,
            { candidate: rejectedCandidate, rejection },
          ],
        };
        partialFailures.push(`extract:${candidate.id}:${result.message}`);
        diagnostics.push(
          stageDiagnostic({
            runId: context.run.id,
            stage: 'parse',
            candidateId: candidate.id,
            startedAtMs: candStarted,
            outcome: 'reject',
            adapter: 'extract',
            reasonCode: 'PARSE_FAILED',
            message: result.message,
          })
        );
        continue;
      }

      const nextCandidate: DiscoveryCandidate = {
        ...candidate,
        extracted: {
          fields: {
            ...candidate.extracted.fields,
            ...result.extracted.fields,
          },
        },
      };
      next = {
        active: [...next.active, nextCandidate],
        rejected: [...next.rejected],
      };
      diagnostics.push(
        stageDiagnostic({
          runId: context.run.id,
          stage: 'parse',
          candidateId: candidate.id,
          startedAtMs: candStarted,
          outcome: 'ok',
          adapter: 'extract',
          message: 'Parsed ExtractedFacts (untrusted)',
        })
      );
    } catch (err) {
      parseRejects += 1;
      const message =
        err instanceof AdapterError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'ContentExtractor threw';
      const rejection = {
        reasonCode: 'REJECTED_OTHER' as const,
        message,
        atStage: 'DISCOVERED' as const,
        at: context.now(),
        details: { failure: 'PARSE_FAILED', rawRef: candidate.raw.ref },
      };
      const rejectedCandidate: DiscoveryCandidate = {
        ...candidate,
        stage: 'REJECTED',
        rejection,
      };
      next = {
        active: [...next.active],
        rejected: [
          ...next.rejected,
          { candidate: rejectedCandidate, rejection },
        ],
      };
      partialFailures.push(`extract:${candidate.id}:${message}`);
      diagnostics.push(
        stageDiagnostic({
          runId: context.run.id,
          stage: 'parse',
          candidateId: candidate.id,
          startedAtMs: candStarted,
          outcome: 'reject',
          adapter: 'extract',
          reasonCode: 'PARSE_FAILED',
          message,
        })
      );
    }
  }

  const nextRun = {
    ...context.run,
    stats: {
      ...context.run.stats,
      candidatesRejected: context.run.stats.candidatesRejected + parseRejects,
    },
  };

  diagnostics.unshift(
    stageDiagnostic({
      runId: context.run.id,
      stage: 'parse',
      startedAtMs: started,
      outcome: parseRejects > 0 ? 'partial' : 'ok',
      adapter: 'extract',
      message: `Parse complete; ${parseRejects} parse failure(s)`,
    })
  );

  return {
    batch: next,
    context: { ...context, run: nextRun },
    diagnostics,
    partialFailures,
  };
}

export async function runNormalizeStage(
  batch: PipelineBatch,
  context: PipelineContext
): Promise<StageExecution> {
  const started = Date.now();
  const nextActive = batch.active.map((candidate) => {
    const normalized = context.strategy.normalize(
      {
        discoveredUrl: candidate.identity.canonicalUrl,
        title:
          typeof candidate.extracted.fields.title === 'string'
            ? candidate.extracted.fields.title
            : undefined,
        snippet:
          typeof candidate.extracted.fields.snippet === 'string'
            ? candidate.extracted.fields.snippet
            : undefined,
        source: candidate.source,
        data: Object.fromEntries(
          Object.entries(candidate.extracted.fields).filter(
            ([key]) => key !== 'title' && key !== 'snippet'
          )
        ) as Record<string, string | number | boolean | null>,
      },
      { runId: context.run.id, discoveredAt: candidate.discoveredAt }
    );
    const next: DiscoveryCandidate = {
      ...candidate,
      identity: normalized.identity,
      extracted: normalized.extracted,
      source: normalized.sourceHints
        ? { ...candidate.source, ...normalized.sourceHints }
        : candidate.source,
      normalized,
      stage: 'NORMALIZED',
    };
    return next;
  });

  return {
    batch: withActive(batch, nextActive),
    context,
    diagnostics: [
      stageDiagnostic({
        runId: context.run.id,
        stage: 'normalize',
        startedAtMs: started,
        outcome: 'ok',
        message: `Normalized ${nextActive.length} candidate(s)`,
      }),
    ],
    partialFailures: [],
  };
}

export async function runDeduplicateStage(
  batch: PipelineBatch,
  context: PipelineContext
): Promise<StageExecution> {
  const started = Date.now();
  const fields = context.strategy.deduplicationPolicy.fingerprintFields;
  const seen = new Set<string>();
  let next: PipelineBatch = { active: [], rejected: [...batch.rejected] };
  let dupes = 0;

  for (const candidate of batch.active) {
    const key = fingerprintKey(candidate, fields);
    if (key && seen.has(key)) {
      dupes += 1;
      const rejection = {
        reasonCode: 'REJECTED_DUPLICATE' as const,
        atStage: 'DEDUPLICATED' as const,
        at: context.now(),
        details: { fingerprint: key },
      };
      const rejectedCandidate: DiscoveryCandidate = {
        ...candidate,
        stage: 'REJECTED',
        rejection,
      };
      next = {
        active: [...next.active],
        rejected: [...next.rejected, { candidate: rejectedCandidate, rejection }],
      };
    } else {
      if (key) seen.add(key);
      next = {
        active: [
          ...next.active,
          { ...candidate, stage: 'DEDUPLICATED' },
        ],
        rejected: [...next.rejected],
      };
    }
  }

  const nextRun = {
    ...context.run,
    stats: {
      ...context.run.stats,
      candidatesRejected: context.run.stats.candidatesRejected + dupes,
    },
  };

  return {
    batch: next,
    context: { ...context, run: nextRun },
    diagnostics: [
      stageDiagnostic({
        runId: context.run.id,
        stage: 'deduplicate',
        startedAtMs: started,
        outcome: dupes > 0 ? 'partial' : 'ok',
        message: `Deduplicated; ${dupes} duplicate(s) rejected`,
      }),
    ],
    partialFailures: [],
  };
}

export async function runFilterStage(
  batch: PipelineBatch,
  context: PipelineContext
): Promise<StageExecution> {
  const started = Date.now();
  let next: PipelineBatch = { active: [], rejected: [...batch.rejected] };
  let rejectedCount = 0;

  for (const candidate of batch.active) {
    const normalized = candidate.normalized ?? {
      identity: candidate.identity,
      extracted: candidate.extracted,
    };
    const result = context.strategy.filter(normalized, context.run.criteriaSnapshot);
    if (result.action === 'REJECT') {
      rejectedCount += 1;
      const rejection = {
        reasonCode: result.reasonCode,
        atStage: 'FILTERED' as const,
        at: context.now(),
        details: result.details,
      };
      const rejectedCandidate: DiscoveryCandidate = {
        ...candidate,
        stage: 'REJECTED',
        rejection,
        deterministicFilterPassed: false,
      };
      next = {
        active: [...next.active],
        rejected: [...next.rejected, { candidate: rejectedCandidate, rejection }],
      };
    } else {
      next = {
        active: [
          ...next.active,
          {
            ...candidate,
            stage: 'FILTERED',
            deterministicFilterPassed: true,
          },
        ],
        rejected: [...next.rejected],
      };
    }
  }

  const nextRun = {
    ...context.run,
    stats: {
      ...context.run.stats,
      candidatesRejected: context.run.stats.candidatesRejected + rejectedCount,
    },
  };

  return {
    batch: next,
    context: { ...context, run: nextRun },
    diagnostics: [
      stageDiagnostic({
        runId: context.run.id,
        stage: 'filter',
        startedAtMs: started,
        outcome: rejectedCount > 0 ? 'partial' : 'ok',
        message: `Filtered; ${rejectedCount} rejected`,
      }),
    ],
    partialFailures: [],
  };
}

/**
 * Verify — strategy verificationPolicy + VerificationAdapter.
 * FAIL / required UNKNOWN → rejected; PASS survivors get VerificationResult + Evidence.
 * AI must not run for rejected/UNKNOWN (gate via isVerificationGateOpen).
 */
export async function runVerifyStage(
  batch: PipelineBatch,
  context: PipelineContext
): Promise<StageExecution> {
  const started = Date.now();
  const verify = context.adapters.verify;
  if (!verify) {
    return {
      batch,
      context,
      diagnostics: [
        stubStageDiagnostic(
          context.run.id,
          'verify',
          started,
          'VerificationAdapter not supplied — verification skipped (explicit stub)'
        ),
      ],
      partialFailures: [],
    };
  }

  const diagnostics: StageDiagnostic[] = [];
  const partialFailures: string[] = [];
  let next: PipelineBatch = { active: [], rejected: [...batch.rejected] };
  let rejectedCount = 0;
  let verifiedPass = 0;

  for (const candidate of batch.active) {
    const candStarted = Date.now();
    try {
      const adapterResult = await verify.verify({
        candidateId: candidate.id,
        identity: candidate.identity,
        source: candidate.source,
        canonicalUrl: candidate.identity.canonicalUrl,
        raw: candidate.raw,
        extracted: candidate.extracted,
        verificationPolicy: context.strategy.verificationPolicy,
        freshnessPolicy: context.strategy.freshnessPolicy,
        run: context.run,
        now: context.now,
        signal: context.signal,
        timeoutMs: context.adapterTimeoutMs,
      });

      if (!adapterResult.ok) {
        rejectedCount += 1;
        const rejection = {
          reasonCode: 'REJECTED_OTHER' as const,
          message: adapterResult.message,
          atStage: 'VERIFYING' as const,
          at: context.now(),
          details: { failure: 'VERIFY_ADAPTER_FAILED' },
        };
        const rejectedCandidate: DiscoveryCandidate = {
          ...candidate,
          stage: 'REJECTED',
          rejection,
        };
        next = {
          active: [...next.active],
          rejected: [
            ...next.rejected,
            { candidate: rejectedCandidate, rejection },
          ],
        };
        partialFailures.push(`verify:${candidate.id}:${adapterResult.message}`);
        diagnostics.push(
          stageDiagnostic({
            runId: context.run.id,
            stage: 'verify',
            candidateId: candidate.id,
            startedAtMs: candStarted,
            outcome: 'reject',
            adapter: 'verify',
            reasonCode: 'VERIFY_ADAPTER_FAILED',
            message: adapterResult.message,
          })
        );
        continue;
      }

      const finalized = finalizeVerificationResult({
        result: {
          ...adapterResult.result,
          verifiedAt: adapterResult.result.verifiedAt || context.now(),
        },
        evidence: adapterResult.evidence,
        policy: context.strategy.verificationPolicy,
      });

      if (!finalized.ok) {
        rejectedCount += 1;
        const rejection = {
          reasonCode: 'REJECTED_OTHER' as const,
          message: finalized.reason,
          atStage: 'VERIFYING' as const,
          at: context.now(),
          details: { failure: 'INVALID_EVIDENCE', reason: finalized.reason },
        };
        const rejectedCandidate: DiscoveryCandidate = {
          ...candidate,
          stage: 'REJECTED',
          rejection,
        };
        next = {
          active: [...next.active],
          rejected: [
            ...next.rejected,
            { candidate: rejectedCandidate, rejection },
          ],
        };
        partialFailures.push(`verify:${candidate.id}:${finalized.reason}`);
        diagnostics.push(
          stageDiagnostic({
            runId: context.run.id,
            stage: 'verify',
            candidateId: candidate.id,
            startedAtMs: candStarted,
            outcome: 'reject',
            adapter: 'verify',
            reasonCode: 'INVALID_EVIDENCE',
            message: finalized.reason,
          })
        );
        continue;
      }

      const { result, evidence } = finalized;

      if (result.status === 'FAIL') {
        rejectedCount += 1;
        const rejection = {
          reasonCode: 'REJECTED_VERIFICATION_FAIL' as const,
          atStage: 'VERIFYING' as const,
          at: context.now(),
          details: {
            status: 'FAIL',
            sourceTrust: result.sourceTrust,
          },
        };
        const rejectedCandidate: DiscoveryCandidate = {
          ...candidate,
          stage: 'REJECTED',
          rejection,
          verification: result,
          evidence: [...evidence],
        };
        next = {
          active: [...next.active],
          rejected: [
            ...next.rejected,
            { candidate: rejectedCandidate, rejection },
          ],
        };
        diagnostics.push(
          stageDiagnostic({
            runId: context.run.id,
            stage: 'verify',
            candidateId: candidate.id,
            startedAtMs: candStarted,
            outcome: 'reject',
            adapter: 'verify',
            reasonCode: 'REJECTED_VERIFICATION_FAIL',
            message: 'Verification FAIL',
          })
        );
        continue;
      }

      if (result.status === 'UNKNOWN') {
        rejectedCount += 1;
        const rejection = {
          reasonCode: 'REJECTED_VERIFICATION_UNKNOWN' as const,
          atStage: 'VERIFYING' as const,
          at: context.now(),
          details: {
            status: 'UNKNOWN',
            sourceTrust: result.sourceTrust,
          },
        };
        const rejectedCandidate: DiscoveryCandidate = {
          ...candidate,
          stage: 'REJECTED',
          rejection,
          verification: result,
          evidence: [...evidence],
        };
        next = {
          active: [...next.active],
          rejected: [
            ...next.rejected,
            { candidate: rejectedCandidate, rejection },
          ],
        };
        diagnostics.push(
          stageDiagnostic({
            runId: context.run.id,
            stage: 'verify',
            candidateId: candidate.id,
            startedAtMs: candStarted,
            outcome: 'reject',
            adapter: 'verify',
            reasonCode: 'REJECTED_VERIFICATION_UNKNOWN',
            message: 'Required verification UNKNOWN — cannot promote',
          })
        );
        continue;
      }

      // PASS
      verifiedPass += 1;
      const nextCandidate: DiscoveryCandidate = {
        ...candidate,
        stage: 'VERIFYING',
        verification: result,
        evidence: [...evidence],
      };
      next = {
        active: [...next.active, nextCandidate],
        rejected: [...next.rejected],
      };
      diagnostics.push(
        stageDiagnostic({
          runId: context.run.id,
          stage: 'verify',
          candidateId: candidate.id,
          startedAtMs: candStarted,
          outcome: 'ok',
          adapter: 'verify',
          message: 'Verification PASS',
        })
      );
    } catch (err) {
      rejectedCount += 1;
      const message =
        err instanceof AdapterError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Verification adapter threw';
      const rejection = {
        reasonCode: 'REJECTED_OTHER' as const,
        message,
        atStage: 'VERIFYING' as const,
        at: context.now(),
        details: { failure: 'VERIFY_ADAPTER_FAILED' },
      };
      const rejectedCandidate: DiscoveryCandidate = {
        ...candidate,
        stage: 'REJECTED',
        rejection,
      };
      next = {
        active: [...next.active],
        rejected: [
          ...next.rejected,
          { candidate: rejectedCandidate, rejection },
        ],
      };
      partialFailures.push(`verify:${candidate.id}:${message}`);
      diagnostics.push(
        stageDiagnostic({
          runId: context.run.id,
          stage: 'verify',
          candidateId: candidate.id,
          startedAtMs: candStarted,
          outcome: 'reject',
          adapter: 'verify',
          reasonCode: 'VERIFY_ADAPTER_FAILED',
          message,
        })
      );
    }
  }

  const nextRun = {
    ...context.run,
    stats: {
      ...context.run.stats,
      candidatesRejected: context.run.stats.candidatesRejected + rejectedCount,
      candidatesVerified: context.run.stats.candidatesVerified + verifiedPass,
    },
  };

  diagnostics.unshift(
    stageDiagnostic({
      runId: context.run.id,
      stage: 'verify',
      startedAtMs: started,
      outcome: rejectedCount > 0 ? 'partial' : 'ok',
      adapter: 'verify',
      message: `Verify complete; ${verifiedPass} PASS, ${rejectedCount} rejected`,
    })
  );

  return {
    batch: next,
    context: { ...context, run: nextRun },
    diagnostics,
    partialFailures,
  };
}

/**
 * AI Evaluate — interprets verified material only.
 * Never modifies VerificationResult / Evidence; never fabricates URLs.
 * Cost/dedupe skips are not AI failures (roadmap E6).
 */
export async function runAiEvaluateStage(
  batch: PipelineBatch,
  context: PipelineContext
): Promise<StageExecution> {
  const started = Date.now();
  const diagnostics: StageDiagnostic[] = [];
  const partialFailures: string[] = [];
  let next: PipelineBatch = { active: [], rejected: [...batch.rejected] };
  let aiUsed = context.aiEvaluationsUsed;
  let inputTokensUsed = context.aiEstimatedInputTokensUsed;
  let outputTokensUsed = context.aiEstimatedOutputTokensUsed;
  let rejectedCount = 0;
  const cache = context.aiEvaluationCache;

  const policy = context.strategy.aiEvaluationPolicy;
  const adapter = context.adapters.ai;
  const emitAi = (
    eventName:
      | 'ai.gate.skipped'
      | 'ai.evaluation.started'
      | 'ai.evaluation.completed'
      | 'ai.evaluation.deduplicated'
      | 'ai.budget.exhausted',
    attributes?: Record<string, string | number | boolean | undefined>
  ) => {
    context.telemetry?.emit({
      eventName,
      runId: context.run.id,
      profileId: context.profile.id,
      strategyId: context.strategy.id,
      attributes,
    });
  };

  for (const candidate of batch.active) {
    const candStarted = Date.now();
    const knownEvidence = candidate.evidence ?? [];
    const tasksForEstimate = [...policy.tasks];

    const fingerprint =
      candidate.verification?.status === 'PASS'
        ? computeAiEvaluationFingerprint({
            strategyId: context.strategy.id,
            strategyVersion: context.strategy.version,
            identity: candidate.identity,
            criteria: context.run.criteriaSnapshot,
            verification: candidate.verification,
            allowedTasks: tasksForEstimate,
            rejectOn: policy.rejectOn,
            extracted: candidate.extracted,
            evidenceIds: knownEvidence.map((e) => e.id),
          })
        : undefined;

    const cachedEntry =
      fingerprint !== undefined ? cache.find(fingerprint) : undefined;
    const candidateExisting =
      fingerprint &&
      candidate.aiEvaluation?.inputFingerprint === fingerprint
        ? candidate.aiEvaluation
        : undefined;

    let reusable: AiEvaluation | undefined;
    if (cachedEntry || candidateExisting) {
      const candidateEval = cachedEntry?.evaluation ?? candidateExisting!;
      const validatedCached = validateAiEvaluation({
        evaluation: candidateEval,
        allowedTasks: tasksForEstimate,
        rejectOn: policy.rejectOn,
        knownEvidenceIds: new Set(knownEvidence.map((e) => e.id)),
      });
      if (validatedCached.ok) {
        reusable = {
          ...validatedCached.evaluation,
          inputFingerprint: fingerprint,
        };
      }
    }

    const accountingPayload =
      candidate.verification?.status === 'PASS'
        ? buildAiAccountingPayload({
            allowedTasks: tasksForEstimate,
            rejectOn: policy.rejectOn,
            identity: candidate.identity,
            verification: candidate.verification,
            evidence: knownEvidence.map((e) => ({
              id: e.id,
              type: e.type,
              statement: e.statement,
            })),
            criteria: context.run.criteriaSnapshot,
            extracted: candidate.extracted,
          })
        : null;
    const pendingInput = accountingPayload
      ? estimateTokensFromStructuredPayload(accountingPayload)
      : 0;
    const pendingOutput = estimateReservedOutputTokens(tasksForEstimate.length);

    const gate = evaluateAiGate({
      candidate,
      strategyPolicy: policy,
      enginePolicy: context.enginePolicy,
      aiEvaluationsUsed: aiUsed,
      hasAdapter: Boolean(adapter),
      alreadyEvaluated: Boolean(reusable),
      estimatedInputTokensUsed: inputTokensUsed,
      estimatedOutputTokensUsed: outputTokensUsed,
      pendingEstimatedInputTokens: pendingInput,
      pendingEstimatedOutputTokens: pendingOutput,
    });

    if (!gate.allow) {
      if (gate.reason === 'AI_ALREADY_EVALUATED' && reusable && fingerprint) {
        const attached = applyAiEvaluation(candidate, reusable, context.now);
        if (attached.kind === 'reject') {
          rejectedCount += 1;
          next = {
            active: [...next.active],
            rejected: [
              ...next.rejected,
              { candidate: attached.candidate, rejection: attached.rejection },
            ],
          };
        } else {
          next = {
            active: [...next.active, attached.candidate],
            rejected: [...next.rejected],
          };
        }
        diagnostics.push(
          stageDiagnostic({
            runId: context.run.id,
            stage: 'ai_evaluate',
            candidateId: candidate.id,
            startedAtMs: candStarted,
            outcome: attached.kind === 'reject' ? 'reject' : 'ok',
            reasonCode: 'AI_ALREADY_EVALUATED',
            message: 'AI skipped: SKIPPED_ALREADY_EVALUATED',
          })
        );
        emitAi('ai.evaluation.deduplicated', {
          candidateId: candidate.id,
          fingerprintPrefix: fingerprint.slice(0, 12),
        });
        emitAi('ai.gate.skipped', {
          candidateId: candidate.id,
          reason: 'AI_ALREADY_EVALUATED',
        });
        continue;
      }

      next = {
        active: [...next.active, { ...candidate }],
        rejected: [...next.rejected],
      };
      diagnostics.push(
        stageDiagnostic({
          runId: context.run.id,
          stage: 'ai_evaluate',
          candidateId: candidate.id,
          startedAtMs: candStarted,
          outcome: gate.reason === 'ADAPTER_MISSING' ? 'stub' : 'ok',
          reasonCode: gate.reason,
          message: `AI skipped: ${gate.reason}`,
        })
      );
      emitAi('ai.gate.skipped', {
        candidateId: candidate.id,
        reason: gate.reason,
      });
      if (
        gate.reason === 'AI_BUDGET_EXHAUSTED' ||
        gate.reason === 'AI_TOKEN_BUDGET_EXHAUSTED'
      ) {
        emitAi('ai.budget.exhausted', {
          candidateId: candidate.id,
          reason: gate.reason,
          aiEvaluationsUsed: aiUsed,
          estimatedInputTokensUsed: inputTokensUsed,
          estimatedOutputTokensUsed: outputTokensUsed,
        });
      }
      continue;
    }

    try {
      emitAi('ai.evaluation.started', {
        candidateId: candidate.id,
        pendingEstimatedInputTokens: pendingInput,
      });
      const adapterResult = await adapter!.evaluate({
        candidateId: candidate.id,
        identity: candidate.identity,
        extracted: candidate.extracted,
        verification: candidate.verification!,
        evidence: knownEvidence,
        criteria: context.run.criteriaSnapshot,
        allowedTasks: gate.tasks,
        rejectOn: policy.rejectOn,
        run: context.run,
        now: context.now,
        signal: context.signal,
        timeoutMs: context.adapterTimeoutMs,
      });
      aiUsed += 1;

      if (!adapterResult.ok) {
        partialFailures.push(`ai:${candidate.id}:${adapterResult.message}`);
        next = {
          active: [...next.active, { ...candidate }],
          rejected: [...next.rejected],
        };
        diagnostics.push(
          stageDiagnostic({
            runId: context.run.id,
            stage: 'ai_evaluate',
            candidateId: candidate.id,
            startedAtMs: candStarted,
            outcome: 'error',
            adapter: 'ai',
            reasonCode: adapterResult.reasonCode,
            message: adapterResult.message,
            costUnits: 1,
          })
        );
        continue;
      }

      const validated = validateAiEvaluation({
        evaluation: adapterResult.evaluation,
        allowedTasks: gate.tasks,
        rejectOn: policy.rejectOn,
        knownEvidenceIds: new Set(knownEvidence.map((e) => e.id)),
      });

      if (!validated.ok) {
        partialFailures.push(`ai:${candidate.id}:${validated.reason}`);
        next = {
          active: [...next.active, { ...candidate }],
          rejected: [...next.rejected],
        };
        diagnostics.push(
          stageDiagnostic({
            runId: context.run.id,
            stage: 'ai_evaluate',
            candidateId: candidate.id,
            startedAtMs: candStarted,
            outcome: 'error',
            adapter: 'ai',
            reasonCode: 'AI_OUTPUT_INVALID',
            message: validated.reason,
            costUnits: 1,
          })
        );
        continue;
      }

      inputTokensUsed += pendingInput;
      outputTokensUsed += estimateTokensFromStructuredPayload(
        validated.evaluation
      );

      const evaluationWithFp: AiEvaluation = {
        ...validated.evaluation,
        inputFingerprint: fingerprint,
      };
      if (fingerprint) {
        cache.save(fingerprint, evaluationWithFp);
      }

      const attached = applyAiEvaluation(
        candidate,
        evaluationWithFp,
        context.now
      );
      if (attached.kind === 'reject') {
        rejectedCount += 1;
        next = {
          active: [...next.active],
          rejected: [
            ...next.rejected,
            { candidate: attached.candidate, rejection: attached.rejection },
          ],
        };
        diagnostics.push(
          stageDiagnostic({
            runId: context.run.id,
            stage: 'ai_evaluate',
            candidateId: candidate.id,
            startedAtMs: candStarted,
            outcome: 'reject',
            adapter: 'ai',
            reasonCode: attached.rejection.reasonCode,
            message: `AI recommended rejection: ${attached.rejection.reasonCode}`,
            costUnits: 1,
          })
        );
      } else {
        next = {
          active: [...next.active, attached.candidate],
          rejected: [...next.rejected],
        };
        diagnostics.push(
          stageDiagnostic({
            runId: context.run.id,
            stage: 'ai_evaluate',
            candidateId: candidate.id,
            startedAtMs: candStarted,
            outcome: 'ok',
            adapter: 'ai',
            message: `AI evaluated ${evaluationWithFp.tasks.length} task(s)`,
            costUnits: 1,
          })
        );
      }
      emitAi('ai.evaluation.completed', {
        candidateId: candidate.id,
        estimatedInputTokens: pendingInput,
        estimatedOutputTokens: estimateTokensFromStructuredPayload(
          evaluationWithFp
        ),
      });
    } catch (err) {
      aiUsed += 1;
      const message =
        err instanceof AdapterError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'AI adapter threw';
      partialFailures.push(`ai:${candidate.id}:${message}`);
      next = {
        active: [...next.active, { ...candidate }],
        rejected: [...next.rejected],
      };
      diagnostics.push(
        stageDiagnostic({
          runId: context.run.id,
          stage: 'ai_evaluate',
          candidateId: candidate.id,
          startedAtMs: candStarted,
          outcome: 'error',
          adapter: 'ai',
          reasonCode: 'AI_ADAPTER_FAILED',
          message,
          costUnits: 1,
        })
      );
    }
  }

  const nextRun = {
    ...context.run,
    stats: {
      ...context.run.stats,
      candidatesRejected: context.run.stats.candidatesRejected + rejectedCount,
    },
  };

  diagnostics.unshift(
    stageDiagnostic({
      runId: context.run.id,
      stage: 'ai_evaluate',
      startedAtMs: started,
      outcome:
        partialFailures.length > 0 || rejectedCount > 0 ? 'partial' : 'ok',
      adapter: 'ai',
      message: `AI evaluate complete; used=${aiUsed}; estIn=${inputTokensUsed}; estOut=${outputTokensUsed}`,
      costUnits: Math.max(0, aiUsed - context.aiEvaluationsUsed),
    })
  );

  return {
    batch: next,
    context: {
      ...context,
      run: nextRun,
      aiEvaluationsUsed: aiUsed,
      aiEstimatedInputTokensUsed: inputTokensUsed,
      aiEstimatedOutputTokensUsed: outputTokensUsed,
      aiEvaluationCache: cache,
    },
    diagnostics,
    partialFailures,
  };
}

function applyAiEvaluation(
  candidate: DiscoveryCandidate,
  evaluation: AiEvaluation,
  now: () => string
):
  | {
      kind: 'active';
      candidate: DiscoveryCandidate;
    }
  | {
      kind: 'reject';
      candidate: DiscoveryCandidate;
      rejection: NonNullable<DiscoveryCandidate['rejection']>;
    } {
  const rejectTask = evaluation.tasks.find(
    (t) => t.outcome === 'REJECT_RECOMMENDED' && t.recommendedRejection
  );
  const verificationCopy = candidate.verification
    ? {
        ...candidate.verification,
        checks: candidate.verification.checks.map((c) => ({ ...c })),
        evidenceIds: [...candidate.verification.evidenceIds],
      }
    : undefined;
  const evidenceCopy = candidate.evidence?.map((e) => ({ ...e }));

  if (rejectTask?.recommendedRejection) {
    const rejection = {
      reasonCode: rejectTask.recommendedRejection,
      atStage: 'AI_EVALUATING' as const,
      at: now(),
      details: {
        task: rejectTask.task,
        via: 'AI_INTERPRETATION',
      },
    };
    return {
      kind: 'reject',
      rejection,
      candidate: {
        ...candidate,
        stage: 'REJECTED',
        rejection,
        aiEvaluation: evaluation,
        verification: verificationCopy,
        evidence: evidenceCopy,
      },
    };
  }

  return {
    kind: 'active',
    candidate: {
      ...candidate,
      stage: 'AI_EVALUATING',
      aiEvaluation: evaluation,
      verification: verificationCopy,
      evidence: evidenceCopy,
    },
  };
}

/**
 * Score — strategy-owned Match + Confidence + breakdown + rank().
 * Engine does not apply a global ranking formula.
 * AI is optional input; verification is authoritative.
 */
export async function runScoreStage(
  batch: PipelineBatch,
  context: PipelineContext
): Promise<StageExecution> {
  const started = Date.now();
  const diagnostics: StageDiagnostic[] = [];
  const partialFailures: string[] = [];
  let next: PipelineBatch = { active: [], rejected: [...batch.rejected] };
  let scoredCount = 0;

  const scoringPolicy = context.strategy.scoringPolicy;
  if (!scoringPolicy?.score || !scoringPolicy.rank) {
    for (const candidate of batch.active) {
      next = {
        active: [...next.active, { ...candidate }],
        rejected: [...next.rejected],
      };
    }
    return {
      batch: next,
      context,
      diagnostics: [
        stageDiagnostic({
          runId: context.run.id,
          stage: 'score',
          startedAtMs: started,
          outcome: 'error',
          reasonCode: 'MISSING_SCORING_POLICY',
          message: 'ScoringPolicy.score/rank not available',
        }),
      ],
      partialFailures: ['score:MISSING_SCORING_POLICY'],
    };
  }

  for (const candidate of batch.active) {
    const candStarted = Date.now();

    if (!candidate.deterministicFilterPassed || candidate.rejection) {
      next = {
        active: [...next.active, { ...candidate }],
        rejected: [...next.rejected],
      };
      diagnostics.push(
        stageDiagnostic({
          runId: context.run.id,
          stage: 'score',
          candidateId: candidate.id,
          startedAtMs: candStarted,
          outcome: 'ok',
          reasonCode: 'SCORE_SKIPPED_FILTER',
          message: 'Score skipped — filter gate',
        })
      );
      continue;
    }

    if (
      context.strategy.verificationPolicy.requireVerificationPass &&
      candidate.verification?.status !== 'PASS'
    ) {
      next = {
        active: [...next.active, { ...candidate }],
        rejected: [...next.rejected],
      };
      diagnostics.push(
        stageDiagnostic({
          runId: context.run.id,
          stage: 'score',
          candidateId: candidate.id,
          startedAtMs: candStarted,
          outcome: 'ok',
          reasonCode: 'SCORE_SKIPPED_VERIFICATION',
          message: 'Score skipped — verification PASS required',
        })
      );
      continue;
    }

    if (!candidate.verification) {
      next = {
        active: [...next.active, { ...candidate }],
        rejected: [...next.rejected],
      };
      diagnostics.push(
        stageDiagnostic({
          runId: context.run.id,
          stage: 'score',
          candidateId: candidate.id,
          startedAtMs: candStarted,
          outcome: 'ok',
          reasonCode: 'SCORE_SKIPPED_NO_VERIFICATION',
          message: 'Score skipped — no VerificationResult',
        })
      );
      continue;
    }

    const verificationSnapshot = {
      ...candidate.verification,
      checks: candidate.verification.checks.map((c) => ({ ...c })),
      evidenceIds: [...candidate.verification.evidenceIds],
    };

    try {
      const rawScore = scoringPolicy.score({
        candidate: {
          id: candidate.id,
          identity: candidate.identity,
          source: candidate.source,
          extracted: candidate.extracted,
          deterministicFilterPassed: candidate.deterministicFilterPassed,
        },
        criteria: context.run.criteriaSnapshot,
        verification: verificationSnapshot,
        evidence: candidate.evidence ?? [],
        aiEvaluation: candidate.aiEvaluation,
        strategyVersion: context.strategy.version,
        scoredAt: context.now(),
      });

      const validated = validateScore({
        score: rawScore,
        policyDimensions: scoringPolicy.dimensions,
        expectedStrategyVersion: context.strategy.version,
      });

      if (!validated.ok) {
        partialFailures.push(`score:${candidate.id}:${validated.reason}`);
        next = {
          active: [...next.active, { ...candidate }],
          rejected: [...next.rejected],
        };
        diagnostics.push(
          stageDiagnostic({
            runId: context.run.id,
            stage: 'score',
            candidateId: candidate.id,
            startedAtMs: candStarted,
            outcome: 'error',
            reasonCode: 'SCORE_INVALID',
            message: validated.reason,
          })
        );
        continue;
      }

      const rankContext: RankContext = {
        opportunityHints: {
          title:
            typeof candidate.extracted.fields.title === 'string'
              ? candidate.extracted.fields.title
              : null,
          deadline:
            typeof candidate.extracted.fields.deadline === 'string' ||
            typeof candidate.extracted.fields.deadline === 'number'
              ? candidate.extracted.fields.deadline
              : null,
        },
        aiEvaluation: candidate.aiEvaluation,
      };
      const rankValue = scoringPolicy.rank(validated.score, rankContext);

      if (typeof rankValue !== 'number' || Number.isNaN(rankValue)) {
        partialFailures.push(`score:${candidate.id}:INVALID_RANK`);
        next = {
          active: [...next.active, { ...candidate }],
          rejected: [...next.rejected],
        };
        diagnostics.push(
          stageDiagnostic({
            runId: context.run.id,
            stage: 'score',
            candidateId: candidate.id,
            startedAtMs: candStarted,
            outcome: 'error',
            reasonCode: 'SCORE_INVALID_RANK',
            message: 'strategy.rank() returned non-number',
          })
        );
        continue;
      }

      scoredCount += 1;
      const nextCandidate: DiscoveryCandidate = {
        ...candidate,
        stage: 'SCORED',
        score: validated.score,
        rankValue,
        verification: verificationSnapshot,
        evidence: candidate.evidence?.map((e) => ({ ...e })),
        aiEvaluation: candidate.aiEvaluation
          ? {
              ...candidate.aiEvaluation,
              tasks: candidate.aiEvaluation.tasks.map((t) => ({ ...t })),
            }
          : undefined,
      };
      next = {
        active: [...next.active, nextCandidate],
        rejected: [...next.rejected],
      };
      diagnostics.push(
        stageDiagnostic({
          runId: context.run.id,
          stage: 'score',
          candidateId: candidate.id,
          startedAtMs: candStarted,
          outcome: 'ok',
          message: `Scored match=${validated.score.matchScore} confidence=${validated.score.confidenceScore} rank=${rankValue}`,
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Scoring threw';
      partialFailures.push(`score:${candidate.id}:${message}`);
      next = {
        active: [...next.active, { ...candidate }],
        rejected: [...next.rejected],
      };
      diagnostics.push(
        stageDiagnostic({
          runId: context.run.id,
          stage: 'score',
          candidateId: candidate.id,
          startedAtMs: candStarted,
          outcome: 'error',
          reasonCode: 'SCORE_EXCEPTION',
          message,
        })
      );
    }
  }

  diagnostics.unshift(
    stageDiagnostic({
      runId: context.run.id,
      stage: 'score',
      startedAtMs: started,
      outcome: partialFailures.length > 0 ? 'partial' : 'ok',
      message: `Score complete; ${scoredCount} scored`,
    })
  );

  return {
    batch: next,
    context,
    diagnostics,
    partialFailures,
  };
}

/**
 * Novelty / State — compare scored candidates to existing Results (read-only).
 * Produces NoveltyDecision for E2.7; does not persist or notify.
 */
export async function runNoveltyStage(
  batch: PipelineBatch,
  context: PipelineContext
): Promise<StageExecution> {
  const started = Date.now();
  const store = context.resultStore;
  if (!store) {
    return {
      batch,
      context,
      diagnostics: [
        stubStageDiagnostic(
          context.run.id,
          'novelty_state',
          started,
          'ResultStore not supplied — novelty skipped (explicit stub)'
        ),
      ],
      partialFailures: [],
    };
  }

  const diagnostics: StageDiagnostic[] = [];
  const partialFailures: string[] = [];
  let next: PipelineBatch = { active: [], rejected: [...batch.rejected] };
  const policy = context.strategy.noveltyPolicy;

  for (const candidate of batch.active) {
    const candStarted = Date.now();

    if (!candidate.score || candidate.stage !== 'SCORED') {
      next = {
        active: [...next.active, { ...candidate }],
        rejected: [...next.rejected],
      };
      diagnostics.push(
        stageDiagnostic({
          runId: context.run.id,
          stage: 'novelty_state',
          candidateId: candidate.id,
          startedAtMs: candStarted,
          outcome: 'ok',
          reasonCode: 'NOVELTY_SKIPPED_NOT_SCORED',
          message: 'Novelty skipped — candidate not SCORED',
        })
      );
      continue;
    }

    let existing;
    try {
      existing = await store.findByIdentity(
        context.profile.id,
        candidate.identity,
        policy.identityFingerprintFields
      );
    } catch (err) {
      const message =
        err instanceof ResultStoreError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'ResultStore failed';
      partialFailures.push(`novelty:${candidate.id}:${message}`);
      next = {
        active: [...next.active, { ...candidate }],
        rejected: [...next.rejected],
      };
      diagnostics.push(
        stageDiagnostic({
          runId: context.run.id,
          stage: 'novelty_state',
          candidateId: candidate.id,
          startedAtMs: candStarted,
          outcome: 'error',
          adapter: 'resultStore',
          reasonCode: 'RESULT_STORE_FAILED',
          message,
        })
      );
      continue;
    }

    const presentation = presentationFromCandidate(candidate);
    const decision = decideNovelty({
      existing,
      candidate,
      presentation,
      policy,
      notification: context.profile.notification,
    });

    const nextCandidate: DiscoveryCandidate = {
      ...candidate,
      noveltyDecision: { ...decision },
      score: candidate.score
        ? {
            ...candidate.score,
            breakdown: {
              dimensions: candidate.score.breakdown.dimensions.map((d) => ({
                ...d,
              })),
            },
          }
        : undefined,
      verification: candidate.verification
        ? {
            ...candidate.verification,
            checks: candidate.verification.checks.map((c) => ({ ...c })),
            evidenceIds: [...candidate.verification.evidenceIds],
          }
        : undefined,
      evidence: candidate.evidence?.map((e) => ({ ...e })),
    };

    next = {
      active: [...next.active, nextCandidate],
      rejected: [...next.rejected],
    };
    diagnostics.push(
      stageDiagnostic({
        runId: context.run.id,
        stage: 'novelty_state',
        candidateId: candidate.id,
        startedAtMs: candStarted,
        outcome: 'ok',
        adapter: 'resultStore',
        message: `${decision.novelty}; lifecycle=${decision.lifecycle}; userState=${decision.userState}; notify=${decision.shouldNotify}; ${decision.reason}`,
      })
    );
  }

  diagnostics.unshift(
    stageDiagnostic({
      runId: context.run.id,
      stage: 'novelty_state',
      startedAtMs: started,
      outcome: partialFailures.length > 0 ? 'partial' : 'ok',
      adapter: 'resultStore',
      message: `Novelty complete; ${next.active.filter((c) => c.noveltyDecision).length} decided`,
    })
  );

  return {
    batch: next,
    context,
    diagnostics,
    partialFailures,
  };
}

/**
 * Persist + Promote — create/update DiscoveryResult after canPromote.
 * Does not send notifications or render digests.
 */
export async function runPersistPromoteStage(
  batch: PipelineBatch,
  context: PipelineContext
): Promise<StageExecution> {
  const started = Date.now();
  const writer = context.resultWriter;
  if (!writer) {
    return {
      batch,
      context,
      diagnostics: [
        stubStageDiagnostic(
          context.run.id,
          'persist_promote',
          started,
          'ResultWriter not supplied — persist/promote skipped (explicit stub)'
        ),
      ],
      partialFailures: [],
    };
  }

  const diagnostics: StageDiagnostic[] = [];
  const partialFailures: string[] = [];
  let next: PipelineBatch = { active: [], rejected: [...batch.rejected] };
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let denied = 0;
  const descriptor = toStrategyDescriptor(context.strategy);
  const fields = context.strategy.noveltyPolicy.identityFingerprintFields;

  for (const candidate of batch.active) {
    const candStarted = Date.now();

    const eligibility = canPromote({
      candidate,
      verification: candidate.verification,
      score: candidate.score,
      strategy: descriptor,
      enginePolicy: context.enginePolicy,
      expectedStrategyId: context.run.strategyId,
      expectedStrategyVersion: context.run.strategyVersion,
      forPersistence: true,
      noveltyDecision: candidate.noveltyDecision,
    });

    if (!eligibility.eligible) {
      denied += 1;
      next = {
        active: [
          ...next.active,
          { ...candidate, persistOutcome: 'DENIED' },
        ],
        rejected: [...next.rejected],
      };
      diagnostics.push(
        stageDiagnostic({
          runId: context.run.id,
          stage: 'persist_promote',
          candidateId: candidate.id,
          startedAtMs: candStarted,
          outcome: 'reject',
          reasonCode: 'PROMOTION_DENIED',
          message: eligibility.reasons.join(','),
        })
      );
      continue;
    }

    const novelty = candidate.noveltyDecision!;
    const existing =
      novelty.existingResultId && context.resultStore
        ? await context.resultStore.findByIdentity(
            context.profile.id,
            candidate.identity,
            fields
          )
        : novelty.novelty === 'NEW'
          ? null
          : context.resultStore
            ? await context.resultStore.findByIdentity(
                context.profile.id,
                candidate.identity,
                fields
              )
            : null;

    // Prefer novelty.existingResultId path; for NEW existing is null
    let existingResult = existing;
    if (novelty.novelty === 'NEW') {
      existingResult = null;
    }

    const plan = buildPersistPlan({
      candidate,
      existing: existingResult,
      novelty,
      profileId: context.profile.id,
      strategyId: context.strategy.id,
      strategyVersion: context.strategy.version,
      identityFingerprintFields: fields,
      materialExtractedFields:
        context.strategy.noveltyPolicy.materialExtractedFields,
      now: context.now(),
    });

    try {
      if (plan.action === 'SKIP_UNCHANGED') {
        unchanged += 1;
        next = {
          active: [
            ...next.active,
            {
              ...candidate,
              stage: 'PROMOTED',
              persistOutcome: 'UNCHANGED',
              promotedResult: plan.result,
            },
          ],
          rejected: [...next.rejected],
        };
        diagnostics.push(
          stageDiagnostic({
            runId: context.run.id,
            stage: 'persist_promote',
            candidateId: candidate.id,
            startedAtMs: candStarted,
            outcome: 'ok',
            adapter: 'resultWriter',
            message: `UNCHANGED result ${plan.result.id}`,
          })
        );
        continue;
      }

      const persisted =
        plan.action === 'CREATE'
          ? await writer.create(plan.result)
          : await writer.update(plan.result);

      if (plan.action === 'CREATE') created += 1;
      else updated += 1;

      next = {
        active: [
          ...next.active,
          {
            ...candidate,
            stage: 'PROMOTED',
            persistOutcome: plan.action === 'CREATE' ? 'CREATED' : 'UPDATED',
            promotedResult: persisted,
          },
        ],
        rejected: [...next.rejected],
      };
      diagnostics.push(
        stageDiagnostic({
          runId: context.run.id,
          stage: 'persist_promote',
          candidateId: candidate.id,
          startedAtMs: candStarted,
          outcome: 'ok',
          adapter: 'resultWriter',
          message: `${plan.action} result ${persisted.id}`,
        })
      );
    } catch (err) {
      const message =
        err instanceof ResultWriterError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'ResultWriter failed';
      partialFailures.push(`persist:${candidate.id}:${message}`);
      next = {
        active: [
          ...next.active,
          { ...candidate, persistOutcome: 'PERSIST_FAILED' },
        ],
        rejected: [...next.rejected],
      };
      diagnostics.push(
        stageDiagnostic({
          runId: context.run.id,
          stage: 'persist_promote',
          candidateId: candidate.id,
          startedAtMs: candStarted,
          outcome: 'error',
          adapter: 'resultWriter',
          reasonCode: 'PERSIST_FAILED',
          message,
        })
      );
    }
  }

  const nextRun = {
    ...context.run,
    stats: {
      ...context.run.stats,
      resultsCreated: context.run.stats.resultsCreated + created,
      resultsUpdated: context.run.stats.resultsUpdated + updated,
    },
  };

  diagnostics.unshift(
    stageDiagnostic({
      runId: context.run.id,
      stage: 'persist_promote',
      startedAtMs: started,
      outcome:
        partialFailures.length > 0 || denied > 0 ? 'partial' : 'ok',
      adapter: 'resultWriter',
      message: `Persist complete; created=${created} updated=${updated} unchanged=${unchanged} denied=${denied}`,
    })
  );

  return {
    batch: next,
    context: { ...context, run: nextRun },
    diagnostics,
    partialFailures,
  };
}

/**
 * E2.8 Digest — presentation-independent domain output from persisted Results.
 * Consumes novelty shouldNotify; does not re-verify, re-score, or notify.
 */
export async function runDigestStage(
  batch: PipelineBatch,
  context: PipelineContext
): Promise<StageExecution> {
  const started = Date.now();
  const sources: DigestCandidateSource[] = [];

  for (const candidate of batch.active) {
    if (!candidate.promotedResult || !candidate.noveltyDecision) continue;
    sources.push({
      candidate,
      promotedResult: candidate.promotedResult,
      noveltyDecision: candidate.noveltyDecision,
      rankValue: candidate.rankValue ?? 0,
    });
  }

  const digest = buildDiscoveryDigest({
    runId: context.run.id,
    profileId: context.profile.id,
    strategyId: context.strategy.id,
    strategyVersion: context.strategy.version,
    generatedAt: context.now(),
    periodFrom: context.run.startedAt,
    sources,
  });

  return {
    batch,
    context: { ...context, digest },
    diagnostics: [
      stageDiagnostic({
        runId: context.run.id,
        stage: 'digest',
        startedAtMs: started,
        outcome: 'ok',
        message: `Digest ${digest.id}; entries=${digest.entries.length} notified=${digest.summary.notifiedResults}`,
      }),
    ],
    partialFailures: [],
  };
}

export async function runStubStage(
  stage: import('./types.js').StageId,
  batch: PipelineBatch,
  context: PipelineContext,
  message: string
): Promise<StageExecution> {
  const started = Date.now();
  return {
    batch,
    context,
    diagnostics: [stubStageDiagnostic(context.run.id, stage, started, message)],
    partialFailures: [],
  };
}
