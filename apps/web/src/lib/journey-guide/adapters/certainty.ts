import type { ConfidencePresentation } from '@/lib/certainty/formatters';
import { formatProgressDelta, getConfidencePresentation } from '@/lib/certainty/formatters';
import type { CertaintyLevel, CertaintyState } from '@/lib/certainty/types';
import { isCertaintyReason } from '@/lib/certainty/validate-certainty-state';
import { toMissionTitle } from '../mission-labels';
import { formatGuideMission, formatGuideOutcome, formatGuideSpeech } from '../formatters';
import type { GuideTone, JourneyGuideViewModel } from '../types';

export type GuideCertaintyContext = {
  recommendedNodeId: string;
  unlockPreview: Array<{ nodeId: string; title: string }>;
};

export function isGuideCertaintyComplete(state: CertaintyState): boolean {
  const nextAction = state.nextAction;
  if (!nextAction || !nextAction.label.trim()) {
    return false;
  }

  return isCertaintyReason(nextAction.reason);
}

function mapConfidenceToGuideTone(confidence: CertaintyLevel | undefined): GuideTone {
  switch (confidence) {
    case 'clear':
      return 'calm';
    case 'needs_attention':
      return 'attentive';
    case 'blocked':
      return 'blocked';
    default:
      return 'exploratory';
  }
}

export function buildJourneyGuideViewModelFromCertainty(
  state: CertaintyState,
  context: GuideCertaintyContext
): JourneyGuideViewModel | null {
  if (!isGuideCertaintyComplete(state) || !state.nextAction) {
    return null;
  }

  const { nextAction } = state;
  const confidence = state.confidence ?? 'unknown';
  const confidencePresentation = getConfidencePresentation(confidence);

  return {
    nodeId: context.recommendedNodeId,
    currentMission: formatGuideMission(state.title, context.recommendedNodeId),
    recommendedStep: formatGuideMission(nextAction.label, context.recommendedNodeId),
    explanation: formatGuideSpeech(state) ?? '',
    outcome: nextAction.expectedOutcome ? formatGuideOutcome(nextAction.expectedOutcome) : undefined,
    tone: mapConfidenceToGuideTone(state.confidence),
    confidencePresentation,
    progress: state.progress
      ? {
          completed: state.progress.completed,
          total: state.progress.total,
          label: formatProgressDelta(state.progress) ?? '',
        }
      : undefined,
    unlockPreview: context.unlockPreview.map((entry) => ({
      nodeId: entry.nodeId,
      title: entry.title,
      missionTitle: toMissionTitle(entry.nodeId, entry.title),
    })),
  };
}

export function viewModelToPlanetRecommendation(
  viewModel: JourneyGuideViewModel
): import('../types').PlanetRecommendation {
  return {
    nodeId: viewModel.nodeId,
    title: viewModel.recommendedStep,
    missionTitle: viewModel.recommendedStep,
    reason: viewModel.explanation,
    unlockPreview: viewModel.unlockPreview,
  };
}
