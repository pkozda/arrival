import type { DiscoveryProfile } from '../types/profile.js';
import type { DiscoveryResult } from '../types/result.js';
import type { NoveltyStatus } from '../types/novelty.js';
import type { ScheduledRunRecord } from '../scheduler/types.js';
import type { ResultState } from '../types/state.js';
import type { DiscoveryExecutionLifecycle } from './execution-lifecycle.js';
import type { ProfileAutomationSummary } from './automation-summary.js';

export type { DiscoveryExecutionLifecycle } from './execution-lifecycle.js';
export type { ProfileAutomationSummary, DiscoveryAutomationCadence } from './automation-summary.js';

export type DiscoveryUserPrincipal = {
  userId: string;
  authenticationMethod: 'bearer';
};

export type UserAuthenticationSuccess = {
  ok: true;
  principal: DiscoveryUserPrincipal;
};

export type UserAuthenticationFailure = {
  ok: false;
  reason: 'unauthenticated';
};

export type UserAuthenticationResult =
  | UserAuthenticationSuccess
  | UserAuthenticationFailure;

export type DiscoveryUserAuthenticator = {
  authenticate(input: {
    authorizationHeader: string | undefined;
  }): UserAuthenticationResult | Promise<UserAuthenticationResult>;
};

export type DiscoveryResultChangeMetadata = {
  inferredNovelty: NoveltyStatus;
  /** Empty when field-level deltas were not persisted on the result record. */
  changedFields: string[];
};

export type DiscoveryResultUserView = DiscoveryResult & {
  changeMetadata: DiscoveryResultChangeMetadata;
};

export type ProfileRunSummary = {
  profileId: string;
  lastRun: ScheduledRunRecord | null;
  /** PD-007 product lifecycle derived from lastRun + run-scoped results. */
  lifecycle: DiscoveryExecutionLifecycle;
  /** Results promoted from lastRun.runId (not profile-total). */
  applicableResultCount: number;
  /** PD-010 schedule + delivery summary. */
  automation: ProfileAutomationSummary;
};

export type ProfileRunNowStatus =
  | 'skipped'
  | 'running'
  | 'success'
  | 'partial_success'
  | 'failed'
  | 'pending';

export type ProfileRunNowResult = {
  profileId: string;
  scheduleId: string;
  runId?: string;
  status: ProfileRunNowStatus;
  skipReason?: string;
  errorMessage?: string;
  lastRun?: ScheduledRunRecord | null;
  lifecycle: DiscoveryExecutionLifecycle;
  applicableResultCount: number;
};

export type CreateDiscoveryProfileInput = {
  id: string;
  name: string;
  strategyId: string;
  strategyVersion: string;
  criteria: DiscoveryProfile['criteria'];
  schedule?: DiscoveryProfile['schedule'];
  notification?: DiscoveryProfile['notification'];
  enabled?: boolean;
};

export type UpdateDiscoveryProfileInput = {
  name?: string;
  criteria?: DiscoveryProfile['criteria'];
  schedule?: DiscoveryProfile['schedule'];
  notification?: Partial<DiscoveryProfile['notification']>;
};

/** Validated profile patch — notification is complete when present. */
export type ValidatedUpdateDiscoveryProfileInput = {
  name?: string;
  criteria?: DiscoveryProfile['criteria'];
  schedule?: DiscoveryProfile['schedule'];
  notification?: DiscoveryProfile['notification'];
};

export type UpdateResultUserStateInput = {
  userState: ResultState;
};
