import { formatReason } from '@/lib/certainty/formatters';
import type { CertaintyState } from '@/lib/certainty/types';

/** Guide explanation — reasoning always comes from Certainty formatters. */
export function formatGuideSpeech(state: CertaintyState): string | null {
  const reason = state.nextAction?.reason;
  if (!reason) {
    return null;
  }

  const explanation = formatReason(reason).trim();
  return explanation.length > 0 ? explanation : null;
}
