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
  source: { trust: string; url?: string };
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
  materialFields?: Record<string, string>;
  identity?: {
    fingerprintMaterial?: Record<string, string | null>;
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
};

export type ProfileRunNowResult = {
  profileId: string;
  scheduleId: string;
  runId?: string;
  status: 'skipped' | 'running' | 'success' | 'partial_success' | 'failed' | 'pending';
  skipReason?: string;
  errorMessage?: string;
  lastRun?: ProfileRunSummary['lastRun'];
};

export type UpdateDiscoveryProfileInput = {
  name?: string;
  criteria?: DiscoveryCriteria;
  schedule?: DiscoveryProfile['schedule'];
  notification?: DiscoveryProfile['notification'];
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
