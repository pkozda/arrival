/**
 * Translation key constants for Certainty chrome (language-neutral).
 * UI resolves these through useApp().t() — do not store prose here.
 */
export const CERTAINTY_COPY_KEYS = {
  locationEyebrow: 'certainty.chrome.locationEyebrow',
  /** Reuses Phase 2A Guide phrasing for the same concept. */
  nextStepHeading: 'guide.recommendedNextStep',
  becauseHeading: 'certainty.chrome.becauseHeading',
  progressHeading: 'certainty.chrome.progressHeading',
  expectedResultPrefix: 'certainty.chrome.expectedResultPrefix',
  progressAriaLabel: 'certainty.progress.ariaLabel',
  confidence: {
    clear: 'certainty.confidence.clear',
    needs_attention: 'certainty.confidence.needsAttention',
    blocked: 'certainty.confidence.blocked',
    unknown: 'certainty.confidence.unknown',
  },
} as const;

/** @deprecated Prefer CERTAINTY_COPY_KEYS — kept as alias for existing imports. */
export const CERTAINTY_COPY = CERTAINTY_COPY_KEYS;
