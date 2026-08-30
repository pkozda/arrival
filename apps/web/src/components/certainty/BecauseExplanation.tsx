'use client';

import type { CertaintyReason } from '@/lib/certainty/types';
import { formatReason } from '@/lib/certainty/formatters';
import { CERTAINTY_COPY_KEYS } from '@/lib/certainty/certainty-copy';
import { resolveCertaintyMessage } from '@/lib/certainty/resolve-message';
import { useApp } from '@/components/AppProvider';

type Props = {
  reason: CertaintyReason;
};

export function BecauseExplanation({ reason }: Props) {
  const { t } = useApp();
  const text = resolveCertaintyMessage(formatReason(reason), t);

  if (!text.trim()) {
    return null;
  }

  return (
    <section className="certainty-because" aria-labelledby="certainty-because-heading">
      <h3 id="certainty-because-heading" className="certainty-because__heading">
        {t(CERTAINTY_COPY_KEYS.becauseHeading)}
      </h3>
      <p className="certainty-because__text">{text}</p>
    </section>
  );
}
