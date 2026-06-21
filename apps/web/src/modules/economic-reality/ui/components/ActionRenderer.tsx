'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { EconomicActionV1, PresentationCardV1 } from '@/lib/product-contract';
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
  card: PresentationCardV1;
};

const cardStyle = {
  padding: '1rem',
  border: '1px solid var(--color-border)',
  borderRadius: '0.5rem',
  marginBottom: '0.75rem',
} as const;

function findAction(actionSet: { actions: EconomicActionV1[] } | undefined, actionId: string) {
  return actionSet?.actions.find((action) => action.id === actionId);
}

function EconomicActionButton({ actionId, labelKey }: { actionId: string; labelKey: string }) {
  const router = useRouter();
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
          router.push(href);
        }
        return;
      }
      case 'update_profile': {
        const href = resolveProfileEditHref(action);
        if (href) {
          router.push(href);
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
        <p
          className="er-action-recorded"
          style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}
          role="status"
        >
          {copy(ER_COPY_KEYS.UI_ACTION_RECORDED)}
        </p>
      )}
      <button
        type="button"
        className="btn btn-secondary"
        style={{ marginTop: recorded ? '0.5rem' : '0.75rem' }}
        disabled={pending || recorded}
        onClick={handleClick}
      >
        {pending ? copy(ER_COPY_KEYS.UI_LOADING) : copy(labelKey)}
      </button>
    </>
  );
}

export function ActionCardView({ card }: Props) {
  const copy = useEconomicCopy();

  return (
    <article style={cardStyle} data-ui-card="ActionCard" data-card-id={card.cardId}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{copy(card.titleKey)}</h3>
      <EconomicActionButton actionId={card.actionRefIds[0]!} labelKey={ER_COPY_KEYS.UI_OPEN_ACTION} />
    </article>
  );
}

export function IntentCardView({ card }: Props) {
  const copy = useEconomicCopy();

  return (
    <article style={cardStyle} data-ui-card="IntentCard" data-card-id={card.cardId}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{copy(card.titleKey)}</h3>
      <EconomicActionButton actionId={card.actionRefIds[0]!} labelKey={ER_COPY_KEYS.UI_START_INTENT} />
    </article>
  );
}

export function ResourceCardView({ card }: Props) {
  const copy = useEconomicCopy();

  return (
    <article style={cardStyle} data-ui-card="ResourceCard" data-card-id={card.cardId}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{copy(card.titleKey)}</h3>
      <EconomicActionButton actionId={card.actionRefIds[0]!} labelKey={ER_COPY_KEYS.UI_OPEN_RESOURCE} />
    </article>
  );
}

export function ProfileCardView({ card }: Props) {
  const copy = useEconomicCopy();

  return (
    <article style={cardStyle} data-ui-card="ProfileCard" data-card-id={card.cardId}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{copy(card.titleKey)}</h3>
      <EconomicActionButton actionId={card.actionRefIds[0]!} labelKey={ER_COPY_KEYS.UI_UPDATE_PROFILE} />
    </article>
  );
}
