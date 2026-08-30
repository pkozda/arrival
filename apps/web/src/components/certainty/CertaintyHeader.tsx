'use client';

import type { CertaintyLevel } from '@/lib/certainty/types';
import { getConfidencePresentation } from '@/lib/certainty/formatters';
import { CERTAINTY_COPY_KEYS } from '@/lib/certainty/certainty-copy';
import { useApp } from '@/components/AppProvider';

type Props = {
  location: string;
  title: string;
  confidence?: CertaintyLevel;
};

export function CertaintyHeader({ location, title, confidence }: Props) {
  const { t } = useApp();
  const presentation = confidence ? getConfidencePresentation(confidence) : null;

  return (
    <header className="certainty-header">
      <p className="certainty-header__eyebrow">{t(CERTAINTY_COPY_KEYS.locationEyebrow)}</p>
      <p className="certainty-header__location">{location}</p>
      <h2 className="certainty-header__title">{title}</h2>
      {presentation && (
        <p
          className={`certainty-header__confidence certainty-header__confidence--${presentation.colorToken}`}
          data-certainty-icon={presentation.icon}
          data-certainty-tone={presentation.tone}
          data-certainty-badge={presentation.badgeVariant}
        >
          {t(presentation.labelKey)}
        </p>
      )}
    </header>
  );
}
