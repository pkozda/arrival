import type { CertaintyLevel } from '@/lib/certainty/types';
import type {
  CurrentSituationResult,
  ResolutionReason,
  SurfaceRegistration,
} from './types';

const CONFIDENCE_RANK: Record<CertaintyLevel, number> = {
  blocked: 4,
  needs_attention: 3,
  clear: 2,
  unknown: 1,
};

type RankedCandidate = SurfaceRegistration & {
  confidence: CertaintyLevel;
  confidenceRank: number;
};

function rankRegistration(registration: SurfaceRegistration): RankedCandidate | null {
  const confidence = registration.bundle.state.confidence;
  if (!confidence) {
    return null;
  }

  return {
    ...registration,
    confidence,
    confidenceRank: CONFIDENCE_RANK[confidence],
  };
}

function compareCandidates(left: RankedCandidate, right: RankedCandidate): number {
  if (left.confidenceRank !== right.confidenceRank) {
    return right.confidenceRank - left.confidenceRank;
  }

  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }

  return left.surface.localeCompare(right.surface);
}

function resolveReason(winner: RankedCandidate, candidates: RankedCandidate[]): ResolutionReason {
  if (candidates.length === 1) {
    return 'only_registered_surface';
  }

  const runnerUp = candidates.find((candidate) => candidate.surface !== winner.surface);

  if (winner.confidence === 'blocked') {
    return 'highest_priority_blocked';
  }

  if (winner.confidence === 'needs_attention') {
    if (runnerUp && runnerUp.confidenceRank < winner.confidenceRank) {
      return 'highest_confidence_needs_attention';
    }
    if (runnerUp && runnerUp.confidenceRank === winner.confidenceRank) {
      return 'highest_surface_priority_tiebreak';
    }
    return 'highest_confidence_needs_attention';
  }

  if (winner.confidence === 'clear') {
    if (runnerUp && runnerUp.confidence === 'unknown') {
      return 'highest_confidence_clear';
    }
    if (runnerUp && runnerUp.confidenceRank === winner.confidenceRank) {
      return 'highest_surface_priority_tiebreak';
    }
    return 'highest_confidence_clear';
  }

  if (runnerUp && runnerUp.confidenceRank === winner.confidenceRank) {
    return 'highest_surface_priority_tiebreak';
  }

  return 'fallback_unknown';
}

export function resolveCurrentSituation(
  registrations: ReadonlyMap<string, SurfaceRegistration>
): CurrentSituationResult | null {
  const candidates = [...registrations.values()]
    .map(rankRegistration)
    .filter((candidate): candidate is RankedCandidate => candidate !== null)
    .sort(compareCandidates);

  if (candidates.length === 0) {
    return null;
  }

  const winner = candidates[0]!;

  return {
    source: winner.surface,
    certainty: winner.bundle.state,
    priority: winner.priority,
    reason: resolveReason(winner, candidates),
  };
}
