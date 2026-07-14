import { toMissionTitle } from '../mission-labels';

/** Guide personality wrapper for the recommended step label. */
export function formatGuideMission(label: string, nodeId: string): string {
  return toMissionTitle(nodeId, label.trim());
}
