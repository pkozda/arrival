'use client';

import type { ReactNode } from 'react';
import { useApp } from '@/components/AppProvider';

type Props = {
  children: ReactNode;
  defaultOpen?: boolean;
};

export function ScenarioExplorerPanel({ children, defaultOpen = false }: Props) {
  const { t } = useApp();

  return (
    <section className="le-explorer-panel le-explorer-panel--demoted" aria-label={t('life-event.explorer.panelTitle')}>
      <details className="le-explorer-panel__details" open={defaultOpen}>
        <summary className="le-explorer-panel__summary">
          <span className="le-explorer-panel__title">{t('life-event.explorer.panelTitle')}</span>
          <span className="le-explorer-panel__badge">{t('life-event.explorer.simulationOnly')}</span>
        </summary>
        <p className="le-explorer-panel__hierarchy">{t('life-event.explorer.notPersonalizedPlan')}</p>
        <p className="le-explorer-panel__disclaimer">{t('life-event.explorer.doesNotAffectPlan')}</p>
        <div className="le-explorer-panel__body">{children}</div>
      </details>
    </section>
  );
}
