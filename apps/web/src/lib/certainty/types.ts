export type CertaintyLevel = 'clear' | 'needs_attention' | 'blocked' | 'unknown';

/**
 * Language-neutral presentation descriptor.
 * Domain/formatters emit this; UI resolves via translation keys + params.
 */
export type CertaintyMessageDescriptor = {
  key: string;
  params?: Record<string, string | number>;
};

/** Semantic "why" — adapters describe meaning; formatters own language keys. */
export type CertaintyReason =
  | {
      type: 'dependency';
      prerequisite: string;
      target: string;
    }
  | {
      type: 'description';
      description: string;
    }
  | {
      type: 'progress';
      target: string;
    };

/** Semantic expected result — what happens if the user takes the next action. */
export type CertaintyExpectedOutcome =
  | {
      type: 'unlock';
      target: string;
    }
  | {
      type: 'openPath';
      target: string;
    };

export type CertaintyNextAction = {
  label: string;
  reason: CertaintyReason;
  expectedOutcome?: CertaintyExpectedOutcome;
};

export type CertaintyProgress = {
  completed: number;
  total: number;
};

export interface CertaintyState {
  location: string;
  title: string;
  nextAction?: CertaintyNextAction;
  progress?: CertaintyProgress;
  confidence?: CertaintyLevel;
};
