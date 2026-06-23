import type { SituationSummary } from '@/lib/situation-utils';

export type HomePresencePhase = 'mapping' | 'transition' | 'stabilizing' | 'mapped';

export type HomePresenceModel = {
  phase: HomePresencePhase;
  statementKey: string;
  contextLine: string | null;
};

type Translate = (key: string) => string;

export function deriveHomePresenceModel(input: {
  showColdStart: boolean;
  planLoading: boolean;
  hasPlan: boolean;
  situationSummary: SituationSummary | null;
  scenarioTitle: string | null;
  t: Translate;
}): HomePresenceModel {
  const { showColdStart, planLoading, hasPlan, situationSummary, scenarioTitle, t } = input;

  let phase: HomePresencePhase;
  let statementKey: string;

  if (planLoading) {
    phase = 'mapping';
    statementKey = 'life-event.home.presence.mapping';
  } else if (showColdStart || (situationSummary?.isEmpty ?? true)) {
    phase = 'transition';
    statementKey = 'life-event.home.presence.transition';
  } else if (hasPlan) {
    phase = 'stabilizing';
    statementKey = 'life-event.home.presence.stabilizing';
  } else {
    phase = 'mapped';
    statementKey = 'life-event.home.presence.mapped';
  }

  const headline = situationSummary?.headlineLines[0] ?? null;
  const contextLine =
    headline ??
    scenarioTitle ??
    (situationSummary && !situationSummary.isEmpty
      ? t('life-event.home.presence.contextMapped')
      : null);

  return { phase, statementKey, contextLine };
}
