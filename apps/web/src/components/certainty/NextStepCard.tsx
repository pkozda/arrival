'use client';

import type { CertaintyExpectedOutcome } from '@/lib/certainty/types';
import { formatExpectedOutcome } from '@/lib/certainty/formatters';
import { CERTAINTY_COPY_KEYS } from '@/lib/certainty/certainty-copy';
import { resolveCertaintyMessage } from '@/lib/certainty/resolve-message';
import { useApp } from '@/components/AppProvider';

type Props = {
  label: string;
  expectedOutcome?: CertaintyExpectedOutcome;
};

export function NextStepCard({ label, expectedOutcome }: Props) {
  const { t } = useApp();
  const expectedResult = expectedOutcome
    ? resolveCertaintyMessage(formatExpectedOutcome(expectedOutcome), t)
    : undefined;

  return (
    <section className="certainty-next-step" aria-labelledby="certainty-next-step-heading">
      <h3 id="certainty-next-step-heading" className="certainty-next-step__heading">
        {t(CERTAINTY_COPY_KEYS.nextStepHeading)}
      </h3>
      <p className="certainty-next-step__label">{label}</p>
      {expectedResult && (
        <p className="certainty-next-step__expected">
          {t(CERTAINTY_COPY_KEYS.expectedResultPrefix)} {expectedResult}
        </p>
      )}
    </section>
  );
}
