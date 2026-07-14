import type { CertaintyExpectedOutcome } from '../types';

/** Formats semantic expected outcome for display alongside next-step copy. */
export function formatExpectedOutcome(outcome: CertaintyExpectedOutcome): string {
  switch (outcome.type) {
    case 'unlock':
      return `This unlocks ${outcome.target}.`;
    case 'openPath':
      return `This opens the path to ${outcome.target}.`;
  }
}
