import type { AtlasSlideDefinition } from './types';

/** Static map state for the guest preview — not a slider slide. */
export const GUEST_LANDING_MAP: AtlasSlideDefinition = {
  id: 'guest-landing',
  index: 0,
  label: '01',
  headline: '',
  supporting: '',
  cta: '',
  ctaHref: '/modules/life-event',
  focusNode: null,
  emphasizedConnections: [],
  completedNodes: [],
  blockedNodes: [],
  journeyStage: 'arrival',
  sidePanel: {
    title: '',
    remaining: [],
    tone: 'overview',
  },
  mapZoom: 1,
};

export const GUEST_LANDING_COPY = {
  eyebrow: 'Personal Life Navigation',
  headline: 'Your new life.',
  headlineAccent: 'Mapped.',
  supporting:
    'Arrival Atlas is your interactive guide through everything you need to build a stable life in a new country.',
  cta: 'Enter Atlas',
  secondary: "See what's next in 7 days",
};
