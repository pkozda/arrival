'use client';

import type { ScenarioMatchV1 } from '@/lib/life-event/scenarios';
import { useApp } from '@/components/AppProvider';
import { localizeScenarioReasoning } from '@/lib/life-event/content-labels';
import { lifeEventScenarioLabel } from '@/lib/life-event/ui-labels';

type Props = {
  scenario: ScenarioMatchV1;
};

export function ScenarioBanner({ scenario }: Props) {
  const { t } = useApp();

  return (
    <aside className="le-scenario-banner" aria-label={t('life-event.scenario.contextShiftTitle')}>
      <p className="le-scenario-banner__title">
        {t('life-event.scenario.contextShiftTitle')}
        <span className="le-scenario-banner__meta">
          ({lifeEventScenarioLabel(t, scenario.scenarioId)})
        </span>
      </p>
      <p className="le-scenario-banner__body">
        {localizeScenarioReasoning(t, scenario.scenarioId, scenario.reasoning)}
      </p>
    </aside>
  );
}
