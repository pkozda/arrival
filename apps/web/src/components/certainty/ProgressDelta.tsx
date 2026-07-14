import type { CertaintyProgress } from '@/lib/certainty/types';
import { formatProgressDelta } from '@/lib/certainty/formatters';
import { CERTAINTY_COPY } from '@/lib/certainty/certainty-copy';

type Props = {
  progress: CertaintyProgress;
};

export function ProgressDelta({ progress }: Props) {
  const { completed, total } = progress;
  if (total <= 0) {
    return null;
  }

  const percent = Math.round((completed / total) * 100);
  const deltaLabel = formatProgressDelta(progress);

  return (
    <section className="certainty-progress" aria-labelledby="certainty-progress-heading">
      <div className="certainty-progress__header">
        <h3 id="certainty-progress-heading" className="certainty-progress__heading">
          {CERTAINTY_COPY.progressHeading}
        </h3>
        <span className="certainty-progress__count">
          {completed}/{total}
        </span>
      </div>
      <div
        className="certainty-progress__track"
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${completed} of ${total} steps completed`}
      >
        <span className="certainty-progress__fill" style={{ width: `${percent}%` }} />
      </div>
      {deltaLabel && <p className="certainty-progress__delta">{deltaLabel}</p>}
    </section>
  );
}
