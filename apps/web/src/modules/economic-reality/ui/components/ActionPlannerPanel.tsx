'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ER_COPY_KEYS } from '@/lib/product-contract';
import type { EconomicRealityClientStateV1 } from '@/lib/economic-reality';
import { useEconomicCopy } from '@/lib/economic-reality';
import { buildActionPlannerViewModel } from '@/lib/economic-reality/build-action-planner-view-model';
import { useApp } from '@/components/AppProvider';
import { AtlasSurface } from '@/components/atlas-runtime/legacy';
import { EconomicActionButton } from './EconomicActionButton';

type Props = {
  state: EconomicRealityClientStateV1;
};

export function ActionPlannerPanel({ state }: Props) {
  const copy = useEconomicCopy();
  const { userContext } = useApp();
  const [showRecalculated, setShowRecalculated] = useState(false);
  const previousHashRef = useRef<string | null>(null);

  const planner = useMemo(() => {
    if (!userContext || !state.actionSet || !state.plan) {
      return null;
    }

    return buildActionPlannerViewModel({
      userContext,
      actionSet: state.actionSet,
      plan: state.plan,
      recommendationKey: state.presentation?.primaryHighlight.labelKey,
    });
  }, [userContext, state.actionSet, state.plan, state.presentation]);

  useEffect(() => {
    const hash = state.deterministicHash;
    if (!hash) {
      return;
    }
    if (previousHashRef.current && previousHashRef.current !== hash) {
      setShowRecalculated(true);
    }
    previousHashRef.current = hash;
  }, [state.deterministicHash]);

  if (!planner) {
    return null;
  }

  const nextActionId = planner.nextAction?.id;

  return (
    <AtlasSurface
      as="section"
      className="mb-md er-action-planner"
      data-ui-panel="ActionPlannerPanel"
      data-planner-status={planner.status}
      data-planner-focus={planner.focus}
    >
      <p className="text-eyebrow">{copy(ER_COPY_KEYS.PLANNER_TITLE)}</p>
      <h2 className="text-section-title mt-sm">{copy(ER_COPY_KEYS.PLANNER_SITUATION)}</h2>
      <p className="text-body mt-sm" data-planner-status-label>
        {copy(planner.statusLabelKey)}
      </p>

      {showRecalculated && (
        <p className="text-meta mt-sm" role="status" data-planner-recalculated>
          {copy(ER_COPY_KEYS.PLANNER_AFTER_CONFIRM)}
        </p>
      )}

      <div className="mt-md">
        <p className="text-eyebrow">{copy(ER_COPY_KEYS.PLANNER_KNOWN)}</p>
        <ul className="text-body mt-sm" data-planner-known>
          {planner.knownFacts.map((fact) => (
            <li key={fact.factId}>
              {copy(fact.labelKey)}:{' '}
              {fact.presence === 'KNOWN' ? copy(ER_COPY_KEYS.PLANNER_STATUS_COMPLETE) : copy(ER_COPY_KEYS.PLANNER_UNKNOWN)}
            </li>
          ))}
        </ul>
      </div>

      {planner.missingReasonKeys.length > 0 && (
        <div className="mt-md">
          <p className="text-eyebrow">{copy(ER_COPY_KEYS.PLANNER_MISSING)}</p>
          <ul className="text-body mt-sm" data-planner-missing>
            {planner.missingReasonKeys.map((key) => (
              <li key={key}>{copy(key)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-md">
        <p className="text-eyebrow">{copy(ER_COPY_KEYS.PLANNER_NEXT)}</p>
        {planner.recommendationKey && (
          <p className="text-body mt-sm" data-planner-recommendation>
            {copy(planner.recommendationKey)}
          </p>
        )}
        {nextActionId && planner.nextAction ? (
          <EconomicActionButton
            actionId={nextActionId}
            labelKey={planner.nextAction.labelKey}
            primary
          />
        ) : (
          <p className="text-body mt-sm">{copy(ER_COPY_KEYS.PLANNER_STATUS_COMPLETE)}</p>
        )}
      </div>
    </AtlasSurface>
  );
}
