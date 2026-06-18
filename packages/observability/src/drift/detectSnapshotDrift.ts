import type { BootstrapIntegritySnapshot } from '../snapshots/types.js';
import type { DriftFinding } from './types.js';

export function detectSnapshotDrift(params: {
  stored: BootstrapIntegritySnapshot;
  recomputed: BootstrapIntegritySnapshot;
}): DriftFinding[] {
  const findings: DriftFinding[] = [];

  if (params.stored.governanceChecksum !== params.recomputed.governanceChecksum) {
    findings.push({
      moduleId: '*',
      type: 'snapshot',
      severity: 'warning',
      message: 'Governance checksum drift detected',
    });
  }

  if (params.stored.snapshotChecksum !== params.recomputed.snapshotChecksum) {
    findings.push({
      moduleId: '*',
      type: 'snapshot',
      severity: 'warning',
      message: 'Contract snapshot checksum drift detected',
    });
  }

  if (params.stored.moduleCount !== params.recomputed.moduleCount) {
    findings.push({
      moduleId: '*',
      type: 'snapshot',
      severity: 'error',
      message: 'Module count drift detected in bootstrap integrity snapshot',
    });
  }

  return findings;
}
