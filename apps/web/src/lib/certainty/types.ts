export type CertaintyLevel = 'clear' | 'needs_attention' | 'blocked' | 'unknown';

/** Semantic "why" — adapters describe meaning; formatters own language. */
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
}
