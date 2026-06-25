'use client';

import type { PresentationCardV1 } from '@/lib/product-contract';
import { ER_COPY_KEYS } from '@/lib/product-contract';
import { EconomicActionButton } from './components/EconomicActionButton';

type Props = {
  card: PresentationCardV1;
};

export function EconomicCardInspectorActions({ card }: Props) {
  const actionId = card.actionRefIds[0];

  if (!actionId) {
    return null;
  }

  const labelKey =
    card.uiType === 'INTENT_CARD'
      ? ER_COPY_KEYS.UI_START_INTENT
      : card.uiType === 'RESOURCE_CARD'
        ? ER_COPY_KEYS.UI_OPEN_RESOURCE
        : card.uiType === 'PROFILE_CARD'
          ? ER_COPY_KEYS.UI_UPDATE_PROFILE
          : ER_COPY_KEYS.UI_OPEN_ACTION;

  return <EconomicActionButton actionId={actionId} labelKey={labelKey} primary />;
}
