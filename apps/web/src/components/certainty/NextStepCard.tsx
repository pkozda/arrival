import type { CertaintyExpectedOutcome } from '@/lib/certainty/types';
import { formatExpectedOutcome } from '@/lib/certainty/formatters';
import { CERTAINTY_COPY } from '@/lib/certainty/certainty-copy';

type Props = {
  label: string;
  expectedOutcome?: CertaintyExpectedOutcome;
};

export function NextStepCard({ label, expectedOutcome }: Props) {
  const expectedResult = expectedOutcome ? formatExpectedOutcome(expectedOutcome) : undefined;

  return (
    <section className="certainty-next-step" aria-labelledby="certainty-next-step-heading">
      <h3 id="certainty-next-step-heading" className="certainty-next-step__heading">
        {CERTAINTY_COPY.nextStepHeading}
      </h3>
      <p className="certainty-next-step__label">{label}</p>
      {expectedResult && (
        <p className="certainty-next-step__expected">
          {CERTAINTY_COPY.expectedResultPrefix} {expectedResult}
        </p>
      )}
    </section>
  );
}
