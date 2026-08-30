import { formatReason } from '@/lib/certainty/formatters';
import type { CertaintyMessageDescriptor, CertaintyState } from '@/lib/certainty/types';

/** Guide explanation — reasoning always comes from Certainty formatters. */
export function formatGuideSpeech(state: CertaintyState): CertaintyMessageDescriptor | null {
  const reason = state.nextAction?.reason;
  if (!reason) {
    return null;
  }

  return formatReason(reason);
}
