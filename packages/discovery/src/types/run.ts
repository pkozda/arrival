import type { DiscoveryCriteria } from './criteria.js';

export type DiscoveryRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'FAILED'
  | 'CANCELLED';

export type RunDiagnostic = {
  code: string;
  message: string;
  adapter?: string;
  at: string;
};

export type DiscoveryRun = {
  id: string;
  profileId: string;
  strategyId: string;
  strategyVersion: string;
  criteriaSnapshot: DiscoveryCriteria;
  startedAt: string;
  finishedAt?: string;
  status: DiscoveryRunStatus;
  stats: {
    candidatesFound: number;
    candidatesRejected: number;
    candidatesVerified: number;
    resultsCreated: number;
    resultsUpdated: number;
  };
  diagnostics?: RunDiagnostic[];
};
