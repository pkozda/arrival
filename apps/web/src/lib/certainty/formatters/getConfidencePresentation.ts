import { CERTAINTY_COPY } from '../certainty-copy';
import type { CertaintyLevel } from '../types';

export type ConfidencePresentation = {
  label: string;
  icon: 'check-circle' | 'alert-circle' | 'lock' | 'help-circle';
  tone: 'clear' | 'attention' | 'blocked' | 'unknown';
  badgeVariant: CertaintyLevel;
  colorToken: CertaintyLevel;
};

const CONFIDENCE_PRESENTATION: Record<CertaintyLevel, ConfidencePresentation> = {
  clear: {
    label: CERTAINTY_COPY.confidence.clear,
    icon: 'check-circle',
    tone: 'clear',
    badgeVariant: 'clear',
    colorToken: 'clear',
  },
  needs_attention: {
    label: CERTAINTY_COPY.confidence.needs_attention,
    icon: 'alert-circle',
    tone: 'attention',
    badgeVariant: 'needs_attention',
    colorToken: 'needs_attention',
  },
  blocked: {
    label: CERTAINTY_COPY.confidence.blocked,
    icon: 'lock',
    tone: 'blocked',
    badgeVariant: 'blocked',
    colorToken: 'blocked',
  },
  unknown: {
    label: CERTAINTY_COPY.confidence.unknown,
    icon: 'help-circle',
    tone: 'unknown',
    badgeVariant: 'unknown',
    colorToken: 'unknown',
  },
};

export function getConfidencePresentation(level: CertaintyLevel): ConfidencePresentation {
  return CONFIDENCE_PRESENTATION[level];
}
