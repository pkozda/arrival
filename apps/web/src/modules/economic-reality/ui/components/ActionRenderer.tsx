'use client';

import type { PresentationCardV1 } from '@/lib/product-contract';
import { ER_COPY_KEYS } from '@/lib/product-contract';
import { executeEconomicAction } from '@/lib/economic-reality/action-executor';
import { useEconomicCopy, useEconomicRealityPlan } from '@/lib/economic-reality';
import { useEconomicFeedbackTracker } from '@/lib/economic-reality/useEconomicFeedbackTracker';

type Props = {
  card: PresentationCardV1;
};

const cardStyle = {
  padding: '1rem',
  border: '1px solid var(--color-border)',
  borderRadius: '0.5rem',
  marginBottom: '0.75rem',
} as const;

function ActionExecuteButton({ actionId, labelKey }: { actionId: string; labelKey: string }) {
  const copy = useEconomicCopy();
  const { refetch } = useEconomicRealityPlan();
  const { trackActionExecuted } = useEconomicFeedbackTracker(refetch);

  return (
    <button
      type="button"
      className="btn btn-secondary"
      style={{ marginTop: '0.75rem' }}
      onClick={() => {
        void executeEconomicAction(actionId)
          .then((result) => trackActionExecuted(result))
          .catch((error: unknown) => {
            const raw = error instanceof Error ? error.message : ER_COPY_KEYS.UI_ERROR;
            const message = raw.startsWith('ER.') ? copy(raw) : raw;
            window.alert(message);
          });
      }}
    >
      {copy(labelKey)}
    </button>
  );
}

export function ActionCardView({ card }: Props) {
  const copy = useEconomicCopy();

  return (
    <article style={cardStyle} data-ui-card="ActionCard" data-card-id={card.cardId}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{copy(card.titleKey)}</h3>
      <ActionExecuteButton actionId={card.actionRefIds[0]!} labelKey={ER_COPY_KEYS.UI_OPEN_ACTION} />
    </article>
  );
}

export function IntentCardView({ card }: Props) {
  const copy = useEconomicCopy();

  return (
    <article style={cardStyle} data-ui-card="IntentCard" data-card-id={card.cardId}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{copy(card.titleKey)}</h3>
      <ActionExecuteButton actionId={card.actionRefIds[0]!} labelKey={ER_COPY_KEYS.UI_START_INTENT} />
    </article>
  );
}

export function ResourceCardView({ card }: Props) {
  const copy = useEconomicCopy();

  return (
    <article style={cardStyle} data-ui-card="ResourceCard" data-card-id={card.cardId}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{copy(card.titleKey)}</h3>
      <ActionExecuteButton actionId={card.actionRefIds[0]!} labelKey={ER_COPY_KEYS.UI_OPEN_RESOURCE} />
    </article>
  );
}

export function ProfileCardView({ card }: Props) {
  const copy = useEconomicCopy();

  return (
    <article style={cardStyle} data-ui-card="ProfileCard" data-card-id={card.cardId}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{copy(card.titleKey)}</h3>
      <ActionExecuteButton actionId={card.actionRefIds[0]!} labelKey={ER_COPY_KEYS.UI_UPDATE_PROFILE} />
    </article>
  );
}
