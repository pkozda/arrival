'use client';

import { useState } from 'react';
import { useAtlasNavigation } from '@/components/atlas-runtime/useAtlasNavigation';
import { AtlasSecondaryButton } from '@/components/atlas-runtime';
import type { EconomicActionV1 } from '@/lib/product-contract';
import { ER_COPY_KEYS } from '@/lib/product-contract';
import { executeEconomicAction, EconomicActionExecutionError } from '@/lib/economic-reality/action-executor';
import { useEconomicCopy, useEconomicRealityPlan } from '@/lib/economic-reality';
import {
  resolveExternalResourceHref,
  resolveOpenModuleHref,
  resolveProfileEditHref,
} from '@/lib/economic-reality/resolve-action-route';
import { useEconomicFeedbackTracker } from '@/lib/economic-reality/useEconomicFeedbackTracker';
import { economicActionContextRef } from '@/lib/economic-reality/action-context';

type Props = {
  actionId: string;
  labelKey: string;
  primary?: boolean;
};

function findAction(actionSet: { actions: EconomicActionV1[] } | undefined, actionId: string) {
  return actionSet?.actions.find((action) => action.id === actionId);
}

export function EconomicActionButton({ actionId, labelKey, primary = false }: Props) {
  const { navigate } = useAtlasNavigation();
  const copy = useEconomicCopy();
  const { actionSet } = useEconomicRealityPlan();
  const { trackActionExecuted } = useEconomicFeedbackTracker();
  const [pending, setPending] = useState(false);
  const [recorded, setRecorded] = useState(false);

  const handleClick = () => {
    const action = findAction(actionSet, actionId);
    if (!action) {
      window.alert(copy(ER_COPY_KEYS.UI_ACTION_STALE));
      return;
    }

    const context = economicActionContextRef.current;

    switch (action.type) {
      case 'open_module': {
        const href = resolveOpenModuleHref(action);
        if (href) {
          navigate(href);
        }
        return;
      }
      case 'update_profile': {
        const href = resolveProfileEditHref(action);
        if (href) {
          navigate(href);
        }
        return;
      }
      case 'external_resource': {
        const href = resolveExternalResourceHref(action);
        if (href) {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
        return;
      }
      case 'system_intent': {
        setPending(true);
        void executeEconomicAction(actionId, context)
          .then((result) => {
            setRecorded(true);
            trackActionExecuted(result);
          })
          .catch((error: unknown) => {
            const raw =
              error instanceof EconomicActionExecutionError
                ? error.message
                : error instanceof Error
                  ? error.message
                  : ER_COPY_KEYS.UI_ERROR;
            const message = raw.startsWith('ER.') ? copy(raw) : raw;
            window.alert(message);
          })
          .finally(() => {
            setPending(false);
          });
        return;
      }
      default: {
        const exhaustive: never = action.type;
        throw new Error(`Unsupported action type: ${exhaustive}`);
      }
    }
  };

  return (
    <>
      {recorded && (
        <p className="text-meta er-action-recorded" style={{ marginTop: '0.75rem' }} role="status">
          {copy(ER_COPY_KEYS.UI_ACTION_RECORDED)}
        </p>
      )}
      <AtlasSecondaryButton
        className={primary ? 'le-consequence-inspector__primary-action' : undefined}
        style={{ marginTop: recorded ? '0.5rem' : '0.75rem' }}
        disabled={pending || recorded}
        onClick={handleClick}
      >
        {pending ? copy(ER_COPY_KEYS.UI_LOADING) : copy(labelKey)}
      </AtlasSecondaryButton>
    </>
  );
}
