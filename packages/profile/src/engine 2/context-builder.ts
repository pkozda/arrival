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
    residencyStatus:
      requestOverrides?.userProfile?.residencyStatus ?? doc.residency?.status,
    income:
      requestOverrides?.userProfile?.income ?? doc.employment?.grossMonthlyIncome,
    householdSize:
      requestOverrides?.userProfile?.householdSize ?? doc.household?.size,
  };

  if (requestOverrides?.userProfile?.residencyStatus) {
    dataProvenance.push({ field: 'userProfile.residencyStatus', source: 'override' });
    recordContextFieldTrace(
      trace,
      'context.userProfile.residencyStatus',
      'override',
      userProfile.residencyStatus
    );
  } else if (doc.residency?.status) {
    dataProvenance.push({ field: 'userProfile.residencyStatus', source: 'profile' });
    recordContextFieldTrace(
      trace,
      'context.userProfile.residencyStatus',
      'profile',
      userProfile.residencyStatus
    );
  }

  if (requestOverrides?.userProfile?.income !== undefined) {
    dataProvenance.push({ field: 'userProfile.income', source: 'override' });
    recordContextFieldTrace(
      trace,
      'context.userProfile.income',
      'override',
      userProfile.income
    );
  } else if (doc.employment?.grossMonthlyIncome !== undefined) {
    dataProvenance.push({ field: 'userProfile.income', source: 'profile' });
    recordContextFieldTrace(
      trace,
      'context.userProfile.income',
      'profile',
      userProfile.income
    );
  }

  if (requestOverrides?.userProfile?.householdSize !== undefined) {
    dataProvenance.push({ field: 'userProfile.householdSize', source: 'override' });
    recordContextFieldTrace(
      trace,
      'context.userProfile.householdSize',
      'override',
      userProfile.householdSize
    );
  } else if (doc.household?.size !== undefined) {
    dataProvenance.push({ field: 'userProfile.householdSize', source: 'profile' });
    recordContextFieldTrace(
      trace,
      'context.userProfile.householdSize',
      'profile',
      userProfile.householdSize
    );
  }

  const location =
    requestOverrides?.location ??
    formatLocation(doc.location?.city, doc.location?.bundesland);

  if (requestOverrides?.location) {
    dataProvenance.push({ field: 'location', source: 'override' });
    recordContextFieldTrace(trace, 'context.location', 'override', location);
  } else if (location) {
    dataProvenance.push({ field: 'location', source: 'profile' });
    recordContextFieldTrace(trace, 'context.location', 'profile', location);
  }

  const systemState = {
    benefits: {
      receivingBuergergeld: doc.benefits?.receivingBuergergeld,
      receivingAlg1: doc.benefits?.receivingAlg1,
      receivingWohngeld: doc.benefits?.receivingWohngeld,
      daysInGermany: doc.benefits?.daysInGermany,
      ...(requestOverrides?.systemState?.benefits ?? {}),
    },
    insurance: {
      hasCoverage: doc.insurance?.hasCoverage,
      type: doc.insurance?.type,
      ...(requestOverrides?.systemState?.insurance ?? {}),
    },
    employmentStatus: doc.employment?.status
      ? { status: doc.employment.status }
      : requestOverrides?.systemState?.employmentStatus,
  };

  if (doc.benefits?.daysInGermany !== undefined) {
    dataProvenance.push({ field: 'systemState.benefits.daysInGermany', source: 'profile' });
  }
  if (doc.insurance?.hasCoverage !== undefined) {
    dataProvenance.push({ field: 'systemState.insurance.hasCoverage', source: 'profile' });
  }

  return {
    sessionId,
    profileId: profile.id,
    profileVersion: profile.revision,
    profileSchemaVersion: profile.document.schemaVersion,
    profileSlice: profileSlice as unknown as Record<string, unknown>,
    userProfile,
    location,
    systemState,
    dataProvenance,
  };
}

function buildWithoutProfile(
  sessionId?: string,
  requestOverrides?: Partial<AppContext>
): AppContext {
  return {
    sessionId,
    userProfile: requestOverrides?.userProfile,
    location: requestOverrides?.location,
    systemState: requestOverrides?.systemState,
    dataProvenance: [],
  };
}

function formatLocation(city?: string, bundesland?: string): string | undefined {
  if (city && bundesland) return `${city}, ${bundesland}`;
  return city ?? bundesland;
}
