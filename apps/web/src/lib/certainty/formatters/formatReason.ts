import type { CertaintyReason, CertaintyMessageDescriptor } from '../types';

/** Maps semantic reason → language-neutral translation descriptor. */
export function formatReason(reason: CertaintyReason): CertaintyMessageDescriptor | null {
  switch (reason.type) {
    case 'dependency':
      return {
        key: 'certainty.reason.dependency',
        params: {
          target: reason.target,
          prerequisite: reason.prerequisite,
        },
      };
    case 'description': {
      const description = reason.description.trim().replace(/\.$/, '');
      if (description.length === 0) {
        return null;
      }
      return {
        key: 'certainty.reason.description',
        params: { description },
      };
    }
    case 'progress':
      return {
        key: 'certainty.reason.progress',
        params: { target: reason.target },
      };
  }
}
