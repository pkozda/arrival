export type DiscoveryCriterion = {
  key: string;
  value: string | number | boolean | null;
  note?: string;
};

export type DiscoveryCriteria = {
  required: DiscoveryCriterion[];
  preferred: DiscoveryCriterion[];
  excluded: DiscoveryCriterion[];
  flexible: DiscoveryCriterion[];
};

export type DiscoveryProfile = {
  id: string;
  userId: string;
  name: string;
  strategyId: string;
  strategyVersion: string;
  criteria: DiscoveryCriteria;
  schedule:
    | { cadence: 'manual' }
    | { cadence: 'daily'; hourUtc: number }
    | { cadence: 'weekly'; dayOfWeek: number; hourUtc: number };
  notification: { emailEnabled: boolean; skipEmptyDigest: boolean };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NoveltyStatus = 'NEW' | 'UPDATED' | 'UNCHANGED';

export type ResultState =
  | 'NEW'
  | 'SEEN'
  | 'NOTIFIED'
  | 'OPENED'
  | 'SAVED'
  | 'DISMISSED'
  | 'EXPIRED';

export type DiscoveryEvidence = {
  id: string;
  type: string;
  sourceUrl?: string;
  statement?: string;
  capturedAt: string;
};

export type DiscoveryResultUserView = {
  id: string;
  profileId: string;
  strategyId: string;
  strategyVersion: string;
  canonicalPresentation: {
    title: string;
    summary?: string;
    primaryUrl?: string;
  };
  source: { trust: string; url?: string; label?: string };
  verification: {
    status: string;
    sourceTrust?: string;
    freshness?: string;
    checks?: Array<{ id: string; outcome: string; required: boolean }>;
    verifiedAt?: string;
  };
  evidence: DiscoveryEvidence[];
  score: {
    matchScore: number;
    confidenceScore: number;
    breakdown?: {
      dimensions: Array<{
        id: string;
        labelKey: string;
        value: number;
        weight: number;
      }>;
    };
    scoredAt: string;
  };
  lifecycle: string;
  userState: ResultState;
  firstSeenAt: string;
  lastVerifiedAt: string;
  lastChangedAt: string;
  promotedFromRunId?: string;
  materialFields?: Record<string, string | number | boolean | null>;
  identity?: {
    canonicalUrl?: string;
    fingerprintMaterial?: Record<string, string | number | boolean | null>;
  };
  changeMetadata: {
    inferredNovelty: NoveltyStatus;
    changedFields: string[];
  };
};

export type ProfileRunSummary = {
  profileId: string;
  lastRun: {
    runId: string;
    scheduleId: string;
    profileId: string;
    trigger: string;
    startedAt: string;
    finishedAt?: string;
    status: string;
    skipReason?: string;
    errorMessage?: string;
  } | null;
  lifecycle: DiscoveryExecutionLifecycle;
  applicableResultCount: number;
  automation: {
    cadence: 'manual' | 'daily' | 'weekly';
    automaticExecution: boolean;
    nextRunAt: string | null;
    hourUtc: number | null;
    profileEnabled: boolean;
    delivery: {
      emailEnabled: boolean;
      skipEmptyDigest: boolean;
    };
    lastRunTrigger: 'manual' | 'scheduled' | null;
  };
};

export type ProfileRunNowResult = {
  profileId: string;
  scheduleId: string;
  runId?: string;
  status: 'skipped' | 'running' | 'success' | 'partial_success' | 'failed' | 'pending';
  skipReason?: string;
  errorMessage?: string;
  lastRun?: ProfileRunSummary['lastRun'];
  lifecycle: DiscoveryExecutionLifecycle;
  applicableResultCount: number;
};

export type UpdateDiscoveryProfileInput = {
  name?: string;
  criteria?: DiscoveryCriteria;
  schedule?: DiscoveryProfile['schedule'];
  notification?: Partial<DiscoveryProfile['notification']>;
};

/** API-only delivery status (not stored on the profile document). */
export type DiscoveryNotificationDeliveryStatus = {
  emailRecipientConfigured: boolean;
};

/** PD-006: server-derived persistence honesty (never invent from profile.userId client-side). */
export type DiscoveryPersistenceScope = 'account' | 'session';

/** PD-007 product-facing Discovery execution lifecycle. */
export type DiscoveryExecutionLifecycle =
  | 'IDLE'
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCESS'
  | 'NO_RESULTS'
  | 'ERROR';

export type DiscoveryPersistenceMeta = {
  persistenceScope: DiscoveryPersistenceScope;
};

export type DiscoveryProfilesListResponse = {
  profiles: DiscoveryProfile[];
} & DiscoveryNotificationDeliveryStatus &
  Partial<DiscoveryPersistenceMeta>;

export type DiscoveryProfileResponse = {
  profile: DiscoveryProfile;
} & DiscoveryNotificationDeliveryStatus &
  Partial<DiscoveryPersistenceMeta>;

/** Persisted user notification email only — never the infrastructure fallback. */
export type DiscoveryNotificationEmailResponse = {
  userNotificationEmail: string | null;
};

export type CreateDiscoveryProfileInput = {
  id: string;
  name: string;
  strategyId: 'job-discovery' | 'giveaway-discovery';
  strategyVersion: '1';
  criteria: DiscoveryCriteria;
  schedule?: DiscoveryProfile['schedule'];
  notification?: DiscoveryProfile['notification'];
  enabled?: boolean;
};

export type DiscoveryStrategyTemplate = 'jobs' | 'giveaways';
