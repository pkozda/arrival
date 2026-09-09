import type {
  AtlasConnectionDefinition,
  AtlasNodeDefinition,
  AtlasNodeId,
  AtlasSlideDefinition,
  JourneyStageId,
} from './types';

/** Structural map nodes — labels resolved via `home.atlas.node.*` keys. */
export const ATLAS_NODES: AtlasNodeDefinition[] = [
  { id: 'center', label: 'home.atlas.node.center', x: 400, y: 300, isCenter: true },
  { id: 'registration', label: 'home.atlas.node.registration', x: 400, y: 118 },
  { id: 'housing', label: 'home.atlas.node.housing', x: 168, y: 268 },
  { id: 'healthcare', label: 'home.atlas.node.healthcare', x: 188, y: 468 },
  { id: 'finance', label: 'home.atlas.node.finance', x: 400, y: 518 },
  { id: 'work', label: 'home.atlas.node.work', x: 632, y: 268 },
  { id: 'community', label: 'home.atlas.node.community', x: 612, y: 468 },
];

export const ATLAS_CONNECTIONS: AtlasConnectionDefinition[] = [
  { from: 'center', to: 'registration' },
  { from: 'center', to: 'housing' },
  { from: 'center', to: 'healthcare' },
  { from: 'center', to: 'finance' },
  { from: 'center', to: 'work' },
  { from: 'center', to: 'community' },
  { from: 'registration', to: 'housing' },
  { from: 'registration', to: 'finance' },
  { from: 'registration', to: 'healthcare' },
  { from: 'housing', to: 'work' },
  { from: 'housing', to: 'finance' },
  { from: 'healthcare', to: 'finance' },
  { from: 'finance', to: 'work' },
  { from: 'work', to: 'community' },
];

/** Labels/subtitles are i18n keys (`home.atlas.stage.*`). */
export const JOURNEY_STAGES: Array<{ id: JourneyStageId; label: string; subtitle: string }> = [
  { id: 'arrival', label: 'home.atlas.stage.arrival', subtitle: 'home.atlas.stage.arrival.subtitle' },
  { id: 'setup', label: 'home.atlas.stage.setup', subtitle: 'home.atlas.stage.setup.subtitle' },
  {
    id: 'stabilize',
    label: 'home.atlas.stage.stabilize',
    subtitle: 'home.atlas.stage.stabilize.subtitle',
  },
  { id: 'build', label: 'home.atlas.stage.build', subtitle: 'home.atlas.stage.build.subtitle' },
];

/** Member slides — user-facing strings are i18n keys under `home.atlas.slide.<id>.*`. */
export const ATLAS_SLIDES: AtlasSlideDefinition[] = [
  {
    id: 'orientation',
    index: 0,
    label: '01',
    headline: 'home.atlas.slide.orientation.headline',
    headlineAccent: 'home.atlas.slide.orientation.headlineAccent',
    supporting: 'home.atlas.slide.orientation.supporting',
    cta: 'home.atlas.slide.orientation.cta',
    ctaHref: '/modules/life-event',
    focusNode: null,
    emphasizedConnections: [],
    completedNodes: [],
    blockedNodes: [],
    journeyStage: 'arrival',
    sidePanel: {
      title: 'home.atlas.slide.orientation.panelTitle',
      status: 'home.atlas.slide.orientation.panelStatus',
      remaining: [
        'home.atlas.slide.orientation.remaining.0',
        'home.atlas.slide.orientation.remaining.1',
        'home.atlas.slide.orientation.remaining.2',
      ],
      tone: 'overview',
    },
    mapZoom: 1,
  },
  {
    id: 'registration',
    index: 1,
    label: '02',
    headline: 'home.atlas.slide.registration.headline',
    headlineAccent: 'home.atlas.slide.registration.headlineAccent',
    supporting: 'home.atlas.slide.registration.supporting',
    cta: 'home.atlas.slide.registration.cta',
    ctaHref: '/modules/life-event',
    focusNode: 'registration',
    emphasizedConnections: [
      ['registration', 'housing'],
      ['registration', 'finance'],
      ['center', 'registration'],
    ],
    completedNodes: [],
    blockedNodes: [],
    journeyStage: 'setup',
    sidePanel: {
      title: 'home.atlas.slide.registration.panelTitle',
      status: 'home.atlas.slide.registration.panelStatus',
      remaining: [
        'home.atlas.slide.registration.remaining.0',
        'home.atlas.slide.registration.remaining.1',
        'home.atlas.slide.registration.remaining.2',
      ],
      nextStep: 'home.atlas.slide.registration.nextStep',
      tone: 'progress',
    },
    mapZoom: 1.06,
  },
  {
    id: 'housing',
    index: 2,
    label: '03',
    headline: 'home.atlas.slide.housing.headline',
    headlineAccent: 'home.atlas.slide.housing.headlineAccent',
    supporting: 'home.atlas.slide.housing.supporting',
    cta: 'home.atlas.slide.housing.cta',
    ctaHref: '/profile',
    focusNode: 'housing',
    emphasizedConnections: [
      ['housing', 'registration'],
      ['housing', 'work'],
      ['center', 'housing'],
    ],
    completedNodes: ['registration'],
    blockedNodes: [],
    journeyStage: 'setup',
    sidePanel: {
      title: 'home.atlas.slide.housing.panelTitle',
      status: 'home.atlas.slide.housing.panelStatus',
      remaining: [
        'home.atlas.slide.housing.remaining.0',
        'home.atlas.slide.housing.remaining.1',
        'home.atlas.slide.housing.remaining.2',
      ],
      nextStep: 'home.atlas.slide.housing.nextStep',
      tone: 'progress',
    },
    mapZoom: 1.08,
  },
  {
    id: 'healthcare',
    index: 3,
    label: '04',
    headline: 'home.atlas.slide.healthcare.headline',
    headlineAccent: 'home.atlas.slide.healthcare.headlineAccent',
    supporting: 'home.atlas.slide.healthcare.supporting',
    cta: 'home.atlas.slide.healthcare.cta',
    ctaHref: '/profile',
    focusNode: 'healthcare',
    emphasizedConnections: [
      ['healthcare', 'registration'],
      ['healthcare', 'finance'],
      ['center', 'healthcare'],
    ],
    completedNodes: ['registration', 'housing'],
    blockedNodes: [],
    journeyStage: 'stabilize',
    sidePanel: {
      title: 'home.atlas.slide.healthcare.panelTitle',
      status: 'home.atlas.slide.healthcare.panelStatus',
      remaining: [
        'home.atlas.slide.healthcare.remaining.0',
        'home.atlas.slide.healthcare.remaining.1',
        'home.atlas.slide.healthcare.remaining.2',
      ],
      nextStep: 'home.atlas.slide.healthcare.nextStep',
      tone: 'progress',
    },
    mapZoom: 1.08,
  },
  {
    id: 'finance',
    index: 4,
    label: '05',
    headline: 'home.atlas.slide.finance.headline',
    headlineAccent: 'home.atlas.slide.finance.headlineAccent',
    supporting: 'home.atlas.slide.finance.supporting',
    cta: 'home.atlas.slide.finance.cta',
    ctaHref: '/modules/economic-reality',
    focusNode: 'finance',
    emphasizedConnections: [
      ['finance', 'work'],
      ['finance', 'registration'],
      ['center', 'finance'],
    ],
    completedNodes: ['registration', 'housing', 'healthcare'],
    blockedNodes: [],
    journeyStage: 'stabilize',
    sidePanel: {
      title: 'home.atlas.slide.finance.panelTitle',
      status: 'home.atlas.slide.finance.panelStatus',
      remaining: [
        'home.atlas.slide.finance.remaining.0',
        'home.atlas.slide.finance.remaining.1',
        'home.atlas.slide.finance.remaining.2',
      ],
      nextStep: 'home.atlas.slide.finance.nextStep',
      tone: 'progress',
    },
    mapZoom: 1.1,
  },
  {
    id: 'growth',
    index: 5,
    label: '06',
    headline: 'home.atlas.slide.growth.headline',
    headlineAccent: 'home.atlas.slide.growth.headlineAccent',
    supporting: 'home.atlas.slide.growth.supporting',
    cta: 'home.atlas.slide.growth.cta',
    ctaHref: '/modules/employment',
    focusNode: 'work',
    emphasizedConnections: [
      ['work', 'community'],
      ['work', 'finance'],
      ['center', 'work'],
    ],
    completedNodes: ['registration', 'housing', 'healthcare', 'finance', 'community'],
    blockedNodes: [],
    journeyStage: 'build',
    sidePanel: {
      title: 'home.atlas.slide.growth.panelTitle',
      status: 'home.atlas.slide.growth.panelStatus',
      remaining: [
        'home.atlas.slide.growth.remaining.0',
        'home.atlas.slide.growth.remaining.1',
        'home.atlas.slide.growth.remaining.2',
      ],
      nextStep: 'home.atlas.slide.growth.nextStep',
      tone: 'future',
    },
    mapZoom: 1.12,
  },
];

/** Slide index when the user selects a map node (member map navigation). */
export function getSlideIndexForNode(nodeId: AtlasNodeId): number {
  if (nodeId === 'center') {
    return 0;
  }

  const focusedSlide = ATLAS_SLIDES.find((slide) => slide.focusNode === nodeId);
  if (focusedSlide) {
    return focusedSlide.index;
  }

  if (nodeId === 'community') {
    return ATLAS_SLIDES.findIndex((slide) => slide.id === 'growth');
  }

  return 0;
}
