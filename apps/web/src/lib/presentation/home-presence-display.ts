import type { HomePresencePhase } from './home-presence';

const EMPHASIS_KEY_BY_STATEMENT: Record<string, string> = {
  'life-event.home.presence.mapping': 'life-event.home.presence.emphasis.mapping',
  'life-event.home.presence.transition': 'life-event.home.presence.emphasis.transition',
  'life-event.home.presence.stabilizing': 'life-event.home.presence.emphasis.stabilizing',
  'life-event.home.presence.mapped': 'life-event.home.presence.emphasis.mapped',
};

export type HeroStatementParts = {
  before: string;
  emphasis: string;
  after: string;
};

export function getHeroEmphasisKey(statementKey: string): string | null {
  return EMPHASIS_KEY_BY_STATEMENT[statementKey] ?? null;
}

export function splitHeroStatement(statement: string, emphasis: string): HeroStatementParts | null {
  const index = statement.toLowerCase().indexOf(emphasis.toLowerCase());
  if (index === -1) {
    return null;
  }

  return {
    before: statement.slice(0, index),
    emphasis: statement.slice(index, index + emphasis.length),
    after: statement.slice(index + emphasis.length),
  };
}

const MORPH_KEYS_BY_PHASE: Record<HomePresencePhase, string[]> = {
  mapping: ['life-event.home.presence.mapping', 'life-event.home.presence.morph.forming'],
  transition: [
    'life-event.home.presence.transition',
    'life-event.home.presence.morph.forming',
    'life-event.home.presence.morph.ready',
  ],
  stabilizing: [
    'life-event.home.presence.stabilizing',
    'life-event.home.presence.morph.ready',
    'life-event.home.presence.morph.aligned',
  ],
  mapped: ['life-event.home.presence.mapped', 'life-event.home.presence.morph.aligned'],
};

const STATUS_KEY_BY_PHASE: Record<HomePresencePhase, string> = {
  mapping: 'life-event.home.presence.status.mapping',
  transition: 'life-event.home.presence.status.transition',
  stabilizing: 'life-event.home.presence.status.stabilizing',
  mapped: 'life-event.home.presence.status.aligned',
};

export function getHeroMorphKeys(phase: HomePresencePhase): string[] {
  return MORPH_KEYS_BY_PHASE[phase];
}

export function getHeroStatusKey(phase: HomePresencePhase): string {
  return STATUS_KEY_BY_PHASE[phase];
}
