'use client';

import type { CertaintyProgress } from '@/lib/certainty/types';
import { formatProgressDelta } from '@/lib/certainty/formatters';
import { CERTAINTY_COPY_KEYS } from '@/lib/certainty/certainty-copy';
import { resolveCertaintyMessage } from '@/lib/certainty/resolve-message';
import { useApp } from '@/components/AppProvider';

type Props = {
  progress: CertaintyProgress;
};

export function ProgressDelta({ progress }: Props) {
  const { t } = useApp();
  const { completed, total } = progress;
  if (total <= 0) {
    return null;
  }

  const percent = Math.round((completed / total) * 100);
  const deltaLabel = resolveCertaintyMessage(formatProgressDelta(progress), t);
  const ariaLabel = resolveCertaintyMessage(
    {
      key: CERTAINTY_COPY_KEYS.progressAriaLabel,
      params: { completed, total },
    },
    t
  );

  return (
    <section className="certainty-progress" aria-labelledby="certainty-progress-heading">
      <div className="certainty-progress__header">
        <h3 id="certainty-progress-heading" className="certainty-progress__heading">
          {t(CERTAINTY_COPY_KEYS.progressHeading)}
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
        aria-label={ariaLabel}
      >
        <span className="certainty-progress__fill" style={{ width: `${percent}%` }} />
      </div>
      {deltaLabel && <p className="certainty-progress__delta">{deltaLabel}</p>}
    </section>
  );
}
