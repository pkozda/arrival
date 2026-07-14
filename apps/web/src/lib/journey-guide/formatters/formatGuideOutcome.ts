import { formatExpectedOutcome } from '@/lib/certainty/formatters';
import type { CertaintyExpectedOutcome } from '@/lib/certainty/types';

/** Guide phrasing for what happens next — semantic source remains Certainty. */
export function formatGuideOutcome(outcome: CertaintyExpectedOutcome): string {
  const formatted = formatExpectedOutcome(outcome);

  if (outcome.type === 'openPath') {
    return formatted.replace(/^This opens the path to /, 'That opens the path to ');
  }

  if (outcome.type === 'unlock') {
    return formatted.replace(/^This unlocks /, 'That unlocks ');
  }

  return formatted;
}
