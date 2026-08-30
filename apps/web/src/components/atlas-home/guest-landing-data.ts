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

/** Translation keys for guest landing copy — resolve via `useApp().t`. */
export const GUEST_LANDING_COPY_KEYS = {
  eyebrow: 'home.guest.eyebrow',
  headline: 'home.guest.headline',
  headlineAccent: 'home.guest.headlineAccent',
  supporting: 'home.guest.supporting',
  cta: 'home.guest.enterAtlas',
  secondary: 'home.guest.secondary',
} as const;
