import { CERTAINTY_COPY_KEYS } from '../certainty-copy';
import type { CertaintyLevel } from '../types';

export type ConfidencePresentation = {
  /** Translation key for the confidence label — resolve in UI via t(). */
  labelKey: string;
  icon: 'check-circle' | 'alert-circle' | 'lock' | 'help-circle';
  tone: 'clear' | 'attention' | 'blocked' | 'unknown';
  badgeVariant: CertaintyLevel;
  colorToken: CertaintyLevel;
};

const CONFIDENCE_PRESENTATION: Record<CertaintyLevel, ConfidencePresentation> = {
  clear: {
    labelKey: CERTAINTY_COPY_KEYS.confidence.clear,
    icon: 'check-circle',
    tone: 'clear',
    badgeVariant: 'clear',
    colorToken: 'clear',
  },
  needs_attention: {
    labelKey: CERTAINTY_COPY_KEYS.confidence.needs_attention,
    icon: 'alert-circle',
    tone: 'attention',
    badgeVariant: 'needs_attention',
    colorToken: 'needs_attention',
  },
  blocked: {
    labelKey: CERTAINTY_COPY_KEYS.confidence.blocked,
    icon: 'lock',
    tone: 'blocked',
    badgeVariant: 'blocked',
    colorToken: 'blocked',
  },
  unknown: {
    labelKey: CERTAINTY_COPY_KEYS.confidence.unknown,
    icon: 'help-circle',
    tone: 'unknown',
    badgeVariant: 'unknown',
    colorToken: 'unknown',
  },
};

export function getConfidencePresentation(level: CertaintyLevel): ConfidencePresentation {
  return CONFIDENCE_PRESENTATION[level];
}
