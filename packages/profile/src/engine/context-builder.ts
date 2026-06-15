import type { AppContext, DataProvenanceEntry } from '@arrivalos/core';
import type { ProfileDocument } from '../types/profile-document.js';
import type { ProfileRecord } from '../types/profile-record.js';
import type { ProfileSlice } from '../types/profile-slice.js';
import type { TraceCollector } from '../trace/trace-collector.js';

export interface BuildAppContextParams {
  sessionId?: string;
  profile: ProfileRecord | null;
  profileSlice: ProfileSlice | null;
  policyDocument: Partial<ProfileDocument> | null;
  requestOverrides?: Partial<AppContext> & {
    inputOverrides?: Record<string, unknown>;
  };
}

function recordContextFieldTrace(
  trace: TraceCollector | undefined,
  field: string,
  source: 'profile' | 'input' | 'default' | 'override',
  value: unknown
): void {
  if (!trace || value === undefined) return;

  if (source === 'override') {
    trace.record({ type: 'INPUT_OVERRIDE', field, value });
  } else if (source === 'profile' || source === 'input' || source === 'default') {
    trace.record({ type: 'MERGE_DECISION', field, source });
  }

  trace.record({ type: 'FINAL_VALUE', field, value });
}

/** @internal Use resolveExecutionContext() as the single entry point. */
export function buildAppContext(
  params: BuildAppContextParams,
  trace?: TraceCollector
): AppContext {
  const { sessionId, profile, profileSlice, policyDocument, requestOverrides } = params;

  if (!profile || !profileSlice || !policyDocument) {
    return buildWithoutProfile(sessionId, requestOverrides);
  }

  const doc = policyDocument;
  const dataProvenance: DataProvenanceEntry[] = [];

  const preferredLanguage =
    requestOverrides?.userProfile?.language ?? doc.preferredLanguage ?? profile.document.preferredLanguage;
  if (requestOverrides?.userProfile?.language) {
    dataProvenance.push({ field: 'userProfile.language', source: 'override' });
    recordContextFieldTrace(
      trace,
      'context.userProfile.language',
      'override',
      preferredLanguage
    );
  } else {
    dataProvenance.push({ field: 'userProfile.language', source: 'profile' });
    recordContextFieldTrace(
      trace,
      'context.userProfile.language',
      'profile',
      preferredLanguage
    );
  }

  const userProfile = {
    language: preferredLanguage,
  };

  return {
    sessionId,
    profileId: profile.id,
    profileVersion: profile.revision,
    profileSchemaVersion: profile.document.schemaVersion,
    profileSlice: profileSlice as unknown as Record<string, unknown>,
    userProfile,
    dataProvenance,
  };
}

function buildWithoutProfile(
  sessionId?: string,
  requestOverrides?: Partial<AppContext>
): AppContext {
  const language = requestOverrides?.userProfile?.language;

  return {
    sessionId,
    userProfile: language !== undefined ? { language } : undefined,
    dataProvenance: [],
  };
}
