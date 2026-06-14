import type { AppContext } from '@arrivalos/core';
import { buildAppContext } from './context-builder.js';
import { mergeModuleInput } from './input-merger.js';
import type { ProfileEngine } from './profile-engine.js';
import {
  applyProfilePolicy,
  buildPolicyConstrainedDocument,
  getModuleProfilePolicy,
} from '../policy/index.js';
import type { ExecutionTrace } from '../trace/execution-trace.js';
import { TraceCollector } from '../trace/trace-collector.js';
import type { ProfileRecord } from '../types/profile-record.js';
import type { ProfileSlice } from '../types/profile-slice.js';
import type { ProfileDocument } from '../types/profile-document.js';

export interface ResolveExecutionContextParams {
  sessionId?: string;
  moduleId: string;
  requestInput?: Record<string, unknown>;
  /** Parsed request context (AppContext fields); may include inputOverrides when passed pre-parse */
  requestContext?: Partial<AppContext> & {
    inputOverrides?: Record<string, unknown>;
  };
  inputOverrides?: Record<string, unknown>;
}

export interface ResolveExecutionContextResult {
  context: AppContext;
  mergedInput: Record<string, unknown>;
  profile: ProfileRecord | null;
  profileSlice: ProfileSlice | null;
  trace: ExecutionTrace;
}

/**
 * Canonical profile resolution pipeline for module execution.
 *
 * Order of operations:
 * 1. Load profile (session binding)
 * 2. Apply module profile policy → ProfileSlice + policy-constrained document
 * 3. Merge module input (precedence rules) using policy-constrained document
 * 4. Build AppContext with policy-filtered profileSlice
 */
export async function resolveExecutionContext(
  profileEngine: ProfileEngine,
  params: ResolveExecutionContextParams
): Promise<ResolveExecutionContextResult> {
  const {
    sessionId,
    moduleId,
    requestInput = {},
    requestContext = {},
    inputOverrides: explicitInputOverrides,
  } = params;

  const profile = sessionId
    ? await profileEngine.getProfileBySession(sessionId)
    : null;

  const traceCollector = new TraceCollector();

  if (profile) {
    traceCollector.record({ type: 'PROFILE_LOADED', profileId: profile.id });
  }

  const modulePolicy = getModuleProfilePolicy(moduleId);

  let profileSlice: ProfileSlice | null = null;
  let policyDocument: Partial<ProfileDocument> | null = null;

  if (profile) {
    profileSlice = applyProfilePolicy(
      profile.document,
      modulePolicy,
      traceCollector
    );
    policyDocument = buildPolicyConstrainedDocument(profile.document, modulePolicy);
  } else {
    traceCollector.record({
      type: 'POLICY_APPLIED',
      policyId: modulePolicy.moduleId,
    });
  }

  const { context: _ctx, inputOverrides: nestedInputOverrides, ...cleanInput } =
    requestInput;

  const inputOverrides: Record<string, unknown> =
    explicitInputOverrides ??
    (nestedInputOverrides as Record<string, unknown> | undefined) ??
    requestContext.inputOverrides ??
    {};

  const { merged: mergedInput, provenance: inputProvenance } = mergeModuleInput(
    moduleId,
    {
      requestInput: cleanInput,
      requestOverrides: inputOverrides,
      profile: (policyDocument as ProfileDocument | null) ?? null,
    },
    traceCollector
  );

  const context = buildAppContext(
    {
      sessionId,
      profile,
      profileSlice,
      policyDocument,
      requestOverrides: requestContext,
    },
    traceCollector
  );

  context.dataProvenance = [
    ...(context.dataProvenance ?? []),
    ...inputProvenance,
  ];

  if (sessionId) {
    context.sessionId = sessionId;
  }

  const trace = traceCollector.build({
    sessionId: sessionId ?? '',
    moduleId,
  });

  return {
    context,
    mergedInput,
    profile,
    profileSlice,
    trace,
  };
}
