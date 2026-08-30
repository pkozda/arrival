import type { CertaintyExpectedOutcome, CertaintyMessageDescriptor } from '@/lib/certainty/types';

/** Guide phrasing for what happens next — semantic source remains Certainty. */
export function formatGuideOutcome(
  outcome: CertaintyExpectedOutcome
): CertaintyMessageDescriptor {
  switch (outcome.type) {
    case 'openPath':
      return {
        key: 'certainty.outcome.openPathGuide',
        params: { target: outcome.target },
      };
    case 'unlock':
      return {
        key: 'certainty.outcome.unlockGuide',
        params: { target: outcome.target },
      };
  }
}
