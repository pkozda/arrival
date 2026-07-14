import type {
  CertaintyExpectedOutcome,
  CertaintyLevel,
  CertaintyReason,
  CertaintyState,
} from './types';

const CERTAINTY_LEVELS: CertaintyLevel[] = ['clear', 'needs_attention', 'blocked', 'unknown'];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isCertaintyLevel(value: unknown): value is CertaintyLevel {
  return typeof value === 'string' && CERTAINTY_LEVELS.includes(value as CertaintyLevel);
}

export function isCertaintyReason(value: unknown): value is CertaintyReason {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    return false;
  }

  const reason = value as { type: string };

  switch (reason.type) {
    case 'dependency':
      return (
        isNonEmptyString((reason as CertaintyReason & { type: 'dependency' }).prerequisite) &&
        isNonEmptyString((reason as CertaintyReason & { type: 'dependency' }).target)
      );
    case 'description':
      return isNonEmptyString((reason as CertaintyReason & { type: 'description' }).description);
    case 'progress':
      return isNonEmptyString((reason as CertaintyReason & { type: 'progress' }).target);
    default:
      return false;
  }
}

export function isCertaintyExpectedOutcome(value: unknown): value is CertaintyExpectedOutcome {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    return false;
  }

  const outcome = value as { type: string };

  switch (outcome.type) {
    case 'unlock':
    case 'openPath':
      return isNonEmptyString((outcome as CertaintyExpectedOutcome).target);
    default:
      return false;
  }
}

export function validateCertaintyState(state: unknown): state is CertaintyState {
  if (!state || typeof state !== 'object') {
    return false;
  }

  const candidate = state as Partial<CertaintyState>;

  if (!isNonEmptyString(candidate.location) || !isNonEmptyString(candidate.title)) {
    return false;
  }

  if (candidate.confidence !== undefined && !isCertaintyLevel(candidate.confidence)) {
    return false;
  }

  if (candidate.nextAction !== undefined) {
    if (!isNonEmptyString(candidate.nextAction.label) || !isCertaintyReason(candidate.nextAction.reason)) {
      return false;
    }

    if (
      candidate.nextAction.expectedOutcome !== undefined &&
      !isCertaintyExpectedOutcome(candidate.nextAction.expectedOutcome)
    ) {
      return false;
    }
  }

  if (candidate.progress !== undefined) {
    const { completed, total } = candidate.progress;
    if (
      typeof completed !== 'number' ||
      typeof total !== 'number' ||
      completed < 0 ||
      total < 0 ||
      completed > total
    ) {
      return false;
    }
  }

  return true;
}
