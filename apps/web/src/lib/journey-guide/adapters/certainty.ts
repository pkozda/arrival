import type { ConfidencePresentation } from '@/lib/certainty/formatters';
import { formatProgressDelta, getConfidencePresentation } from '@/lib/certainty/formatters';
import { resolveCertaintyMessage } from '@/lib/certainty/resolve-message';
import type { CertaintyLevel, CertaintyState } from '@/lib/certainty/types';
import { isCertaintyReason } from '@/lib/certainty/validate-certainty-state';
import { toMissionTitle, missionLabelKey, type GuideTranslate } from '../mission-labels';
import { formatGuideMission, formatGuideOutcome, formatGuideSpeech } from '../formatters';
import type { GuideTone, JourneyGuideViewModel } from '../types';

export type GuideCertaintyContext = {
  recommendedNodeId: string;
  unlockPreview: Array<{ nodeId: string; title: string }>;
  /** Resolves Certainty descriptors and known mission chrome labels. */
  t: GuideTranslate;
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

/**
 * Localizes descriptor params when the value is a known mission node id.
 * Free-form LE/profile titles from adapters are left as domain content
 * (they may already be localized via titleForNode / content dictionaries).
 */
function localizeTitleParam(raw: string, t: GuideTranslate): string {
  if (missionLabelKey(raw)) {
    return toMissionTitle(raw, raw, t);
  }
  return raw;
}

function localizeDescriptorParams(
  descriptor: ReturnType<typeof formatGuideSpeech>,
  t: GuideTranslate
): ReturnType<typeof formatGuideSpeech> {
  if (!descriptor?.params) {
    return descriptor;
  }

  const params = { ...descriptor.params };
  for (const name of ['target', 'prerequisite'] as const) {
    const value = params[name];
    if (typeof value === 'string') {
      params[name] = localizeTitleParam(value, t);
    }
  }

  return { ...descriptor, params };
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
  const translate = context.t;

  const speechDescriptor = localizeDescriptorParams(formatGuideSpeech(state), translate);
  const outcomeDescriptor = nextAction.expectedOutcome
    ? localizeDescriptorParams(formatGuideOutcome(nextAction.expectedOutcome), translate)
    : null;

  return {
    nodeId: context.recommendedNodeId,
    currentMission: formatGuideMission(state.title, context.recommendedNodeId, translate),
    recommendedStep: formatGuideMission(nextAction.label, context.recommendedNodeId, translate),
    explanation: resolveCertaintyMessage(speechDescriptor, translate),
    outcome: outcomeDescriptor
      ? resolveCertaintyMessage(outcomeDescriptor, translate)
      : undefined,
    tone: mapConfidenceToGuideTone(state.confidence),
    confidencePresentation,
    progress: state.progress
      ? {
          completed: state.progress.completed,
          total: state.progress.total,
          label: resolveCertaintyMessage(formatProgressDelta(state.progress), translate),
        }
      : undefined,
    unlockPreview: context.unlockPreview.map((entry) => ({
      nodeId: entry.nodeId,
      title: entry.title,
      missionTitle: toMissionTitle(entry.nodeId, entry.title, translate),
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
