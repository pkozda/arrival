'use client';

import type { PresentationCardV1 } from '@/lib/product-contract';
import { ER_COPY_KEYS } from '@/lib/product-contract';
import { useEconomicCopy } from '@/lib/economic-reality';
import { EconomicActionButton } from './EconomicActionButton';

type Props = {
  card: PresentationCardV1;
};

export function ActionCardView({ card }: Props) {
  const copy = useEconomicCopy();

  return (
    <article className="atlas-inline-surface" data-ui-card="ActionCard" data-card-id={card.cardId}>
      <h3 className="text-section-title--sm">{copy(card.titleKey)}</h3>
      <EconomicActionButton actionId={card.actionRefIds[0]!} labelKey={ER_COPY_KEYS.UI_OPEN_ACTION} />
    </article>
  );
}

export function IntentCardView({ card }: Props) {
  const copy = useEconomicCopy();

  return (
    <article className="atlas-inline-surface" data-ui-card="IntentCard" data-card-id={card.cardId}>
      <h3 className="text-section-title--sm">{copy(card.titleKey)}</h3>
      <EconomicActionButton actionId={card.actionRefIds[0]!} labelKey={ER_COPY_KEYS.UI_START_INTENT} />
    </article>
  );
}

export function ResourceCardView({ card }: Props) {
  const copy = useEconomicCopy();

  return (
    <article className="atlas-inline-surface" data-ui-card="ResourceCard" data-card-id={card.cardId}>
      <h3 className="text-section-title--sm">{copy(card.titleKey)}</h3>
      <EconomicActionButton actionId={card.actionRefIds[0]!} labelKey={ER_COPY_KEYS.UI_OPEN_RESOURCE} />
    </article>
  );
}

export function ProfileCardView({ card }: Props) {
  const copy = useEconomicCopy();

  return (
    <article className="atlas-inline-surface" data-ui-card="ProfileCard" data-card-id={card.cardId}>
      <h3 className="text-section-title--sm">{copy(card.titleKey)}</h3>
      <EconomicActionButton actionId={card.actionRefIds[0]!} labelKey={ER_COPY_KEYS.UI_UPDATE_PROFILE} />
    </article>
  );
}
