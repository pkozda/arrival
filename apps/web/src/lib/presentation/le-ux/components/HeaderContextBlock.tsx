'use client';

import type { LifeEventPlanV1 } from '@/lib/product-contract';
import type { ScenarioMatchV1 } from '@/lib/life-event/scenarios';
import { useApp } from '@/components/AppProvider';
import {
  lifeEventPlanConfidenceLabel,
  lifeEventScenarioLabel,
  lifeEventStateLabel,
} from '@/lib/life-event/ui-labels';
import { leConfidenceClass } from '@/lib/presentation/le-ux/severity';

type Props = {
  plan: LifeEventPlanV1;
  scenario?: ScenarioMatchV1 | null;
};

export function HeaderContextBlock({ plan, scenario }: Props) {
  const { t } = useApp();

  return (
    <section className="le-context" aria-label={t('life-event.plan.currentSituation')}>
      <div>
        <p className="le-context__label">{t('life-event.plan.currentSituation')}</p>
        <div className="le-context__badges">
          <span className="badge le-state-badge">{lifeEventStateLabel(t, plan.currentLifeState)}</span>
          {scenario && (
            <span
              className="badge badge-low le-scenario-badge"
              title={t('life-event.scenario.contextShiftTitle')}
            >
              {lifeEventScenarioLabel(t, scenario.scenarioId)}
            </span>
          )}
        </div>
      </div>
      <div className={leConfidenceClass(plan.reasoning.planConfidence)}>
        <span className="le-confidence__label">{t('life-event.plan.planConfidence')}</span>
        <span className="le-confidence__value">
          {lifeEventPlanConfidenceLabel(t, plan.reasoning.planConfidence)}
        </span>
      </div>
    </section>
  );
}
