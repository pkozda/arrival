import type { CertaintyMessageDescriptor, CertaintyProgress } from '../types';

/** Maps progress counts → language-neutral translation descriptor. */
export function formatProgressDelta(
  progress: CertaintyProgress
): CertaintyMessageDescriptor | null {
  const { completed, total } = progress;

  if (total <= 0) {
    return null;
  }

  if (completed > 0) {
    return {
      key: 'certainty.progress.partial',
      params: { completed, total },
    };
  }

  return {
    key: 'certainty.progress.noneCompleted',
    params: { total },
  };
}
