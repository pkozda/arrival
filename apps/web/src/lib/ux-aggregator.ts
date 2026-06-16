import type { UxActionCard } from './api';
import { getAllUxByModule, getLastUpdated } from './ux-store';

const MODULE_PRIORITY_ORDER = [
  'financial-reality',
  'healthcare-navigation',
  'life-event',
  'grocery-optimization',
  'system-translation',
] as const;

const ACTION_PRIORITY_RANK: Record<UxActionCard['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function moduleRank(source: string): number {
  const index = MODULE_PRIORITY_ORDER.indexOf(source as (typeof MODULE_PRIORITY_ORDER)[number]);
  return index === -1 ? MODULE_PRIORITY_ORDER.length : index;
}

function actionKey(action: UxActionCard): string {
  return `${action.id}:${action.source}`;
}

function sortActions(actions: UxActionCard[]): UxActionCard[] {
  return [...actions].sort((a, b) => {
    const moduleDiff = moduleRank(a.source) - moduleRank(b.source);
    if (moduleDiff !== 0) return moduleDiff;

    const priorityDiff = ACTION_PRIORITY_RANK[a.priority] - ACTION_PRIORITY_RANK[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    return a.title.localeCompare(b.title);
  });
}

function describeAction(action: UxActionCard): string {
  switch (action.id) {
    case 'anmeldung':
      return 'register your address at the Bürgeramt';
    case 'krankenkasse':
    case 'choose-insurance':
      return 'confirm your health insurance';
    case 'buergergeld':
      return 'check your Bürgergeld eligibility with the Jobcenter';
    case 'wohngeld':
      return 'explore Wohngeld housing support';
    case 'translation-info':
      return 'review key administrative terms';
    default:
      return action.title.toLowerCase();
  }
}

function buildGlobalSummary(actions: UxActionCard[]): string {
  const topHigh = actions.filter((action) => action.priority === 'high').slice(0, 2);

  if (topHigh.length === 0) {
    const topMedium = actions.filter((action) => action.priority === 'medium').slice(0, 2);
    if (topMedium.length === 0) {
      return actions.length > 0
        ? 'Review the recommended actions below to continue your integration journey in Germany.'
        : '';
    }

    const phrases = topMedium.map(describeAction);
    if (phrases.length === 1) {
      return `You should ${phrases[0]} as your next step in Germany.`;
    }

    return `You should ${phrases[0]} and ${phrases[1]} as your next steps in Germany.`;
  }

  const phrases = topHigh.map(describeAction);

  if (phrases.length === 1) {
    return `You should ${phrases[0]}. This is your most urgent next step across Arrive Atlas.`;
  }

  const hasAdministrativePair =
    topHigh.some((action) => action.id === 'anmeldung') &&
    topHigh.some((action) => action.id === 'krankenkasse' || action.id === 'choose-insurance');

  if (hasAdministrativePair) {
    return 'You should register your address at the Bürgeramt and confirm your health insurance. These are your most urgent administrative steps in Germany.';
  }

  return `You should ${phrases[0]} and ${phrases[1]}. These are your most urgent next steps across Arrive Atlas.`;
}

export function buildGlobalUxPlan(): {
  actions: UxActionCard[];
  summary: string;
} {
  const entries = getAllUxByModule().sort(
    (a, b) => moduleRank(a.moduleId) - moduleRank(b.moduleId)
  );

  const seen = new Set<string>();
  const actions: UxActionCard[] = [];

  for (const { ux } of entries) {
    for (const action of ux.actions) {
      const key = actionKey(action);
      if (seen.has(key)) continue;
      seen.add(key);
      actions.push(action);
    }
  }

  const sortedActions = sortActions(actions);

  return {
    actions: sortedActions,
    summary: buildGlobalSummary(sortedActions),
  };
}

export type AttentionFocus = {
  title: string;
  reason: string;
  primaryAction?: UxActionCard;
};

function getFramingTitle(action: UxActionCard): string {
  if (
    action.source === 'healthcare-navigation' ||
    action.id === 'choose-insurance' ||
    action.id === 'krankenkasse'
  ) {
    return 'Health coverage gap detected';
  }

  if (action.source === 'grocery-optimization') {
    return 'Financial optimization opportunity';
  }

  if (action.source === 'life-event') {
    return 'Life transition priority detected';
  }

  if (action.source === 'system-translation') {
    return 'Guidance available';
  }

  if (action.id === 'buergergeld' || action.id === 'wohngeld') {
    return 'Financial support opportunity';
  }

  return 'Administrative priority detected';
}

function buildAttentionReason(action: UxActionCard): string {
  if (action.id === 'anmeldung') {
    return 'You may need to register your address (Anmeldung) based on your current situation in Germany.';
  }

  if (action.description.trim().length > 0) {
    return action.description;
  }

  return `You may need to ${action.title.toLowerCase()} based on your current situation in Germany.`;
}

function selectPrimaryAction(actions: UxActionCard[]): UxActionCard | undefined {
  if (actions.length === 0) return undefined;

  const highActions = actions.filter((action) => action.priority === 'high');
  const candidates = highActions.length > 0 ? highActions : actions;
  const topRank = moduleRank(candidates[0].source);
  const sameRank = candidates.filter((action) => moduleRank(action.source) === topRank);

  if (sameRank.length === 1) {
    return sameRank[0];
  }

  return [...sameRank].sort(
    (a, b) => (getLastUpdated(b.source) ?? 0) - (getLastUpdated(a.source) ?? 0)
  )[0];
}

export function buildAttentionFocus(): AttentionFocus | null {
  const plan = buildGlobalUxPlan();
  const primaryAction = selectPrimaryAction(plan.actions);

  if (!primaryAction) {
    return null;
  }

  return {
    title: getFramingTitle(primaryAction),
    reason: buildAttentionReason(primaryAction),
    primaryAction,
  };
}

export function hasGlobalUx(): boolean {
  const plan = buildGlobalUxPlan();
  return plan.actions.length > 0 || plan.summary.trim().length > 0;
}
