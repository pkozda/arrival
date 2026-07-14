import type { CertaintyProgress } from '../types';

/** Formats progress delta copy from semantic counts. */
export function formatProgressDelta(progress: CertaintyProgress): string | null {
  const { completed, total } = progress;

  if (total <= 0) {
    return null;
  }

  if (completed > 0) {
    return `${completed} of ${total} steps are already in place.`;
  }

  return `${total} steps in your plan.`;
}
