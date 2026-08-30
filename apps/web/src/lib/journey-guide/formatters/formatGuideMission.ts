import { toMissionTitle, type GuideTranslate } from '../mission-labels';

/** Guide personality wrapper for the recommended step label. */
export function formatGuideMission(label: string, nodeId: string, t?: GuideTranslate): string {
  return toMissionTitle(nodeId, label.trim(), t);
}
