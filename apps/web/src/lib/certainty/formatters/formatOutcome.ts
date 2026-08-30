import type { CertaintyExpectedOutcome, CertaintyMessageDescriptor } from '../types';

/** Maps semantic expected outcome → language-neutral translation descriptor. */
export function formatExpectedOutcome(
  outcome: CertaintyExpectedOutcome
): CertaintyMessageDescriptor {
  switch (outcome.type) {
    case 'unlock':
      return {
        key: 'certainty.outcome.unlock',
        params: { target: outcome.target },
      };
    case 'openPath':
      return {
        key: 'certainty.outcome.openPath',
        params: { target: outcome.target },
      };
  }
}
