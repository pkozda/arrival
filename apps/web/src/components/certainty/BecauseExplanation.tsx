import type { CertaintyReason } from '@/lib/certainty/types';
import { formatReason } from '@/lib/certainty/formatters';
import { CERTAINTY_COPY } from '@/lib/certainty/certainty-copy';

type Props = {
  reason: CertaintyReason;
};

export function BecauseExplanation({ reason }: Props) {
  const text = formatReason(reason);

  if (!text.trim()) {
    return null;
  }

  return (
    <section className="certainty-because" aria-labelledby="certainty-because-heading">
      <h3 id="certainty-because-heading" className="certainty-because__heading">
        {CERTAINTY_COPY.becauseHeading}
      </h3>
      <p className="certainty-because__text">{text}</p>
    </section>
  );
}
