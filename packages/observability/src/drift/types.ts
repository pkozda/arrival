export type DriftSeverity = 'warning' | 'error';

export type DriftType = 'schema' | 'capability' | 'version' | 'snapshot' | 'normalizer';

export type DriftFinding = {
  moduleId: string;
  type: DriftType;
  severity: DriftSeverity;
  message: string;
};
