import type { CertaintyReason } from '../types';

/** Formats semantic reason into Calm Navigator copy. */
export function formatReason(reason: CertaintyReason): string {
  switch (reason.type) {
    case 'dependency':
      return `To unlock ${reason.target}, ${reason.prerequisite} is needed first.`;
    case 'description': {
      const description = reason.description.trim().replace(/\.$/, '');
      return description.length > 0
        ? `Do this now because ${description}.`
        : '';
    }
    case 'progress':
      return `Do this now because it moves ${reason.target} forward.`;
  }
}
