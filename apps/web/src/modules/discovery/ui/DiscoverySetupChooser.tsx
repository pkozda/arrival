'use client';

import { useApp } from '@/components/AppProvider';

type Props = {
  onStartGuided: () => void;
  onStartSelfDirected: () => void;
};

/** Discovery-specific entry: real Guided wizard vs existing New profile form. */
export function DiscoverySetupChooser({ onStartGuided, onStartSelfDirected }: Props) {
  const { t } = useApp();

  return (
    <section
      className="discovery-panel"
      data-ui-surface="discovery-setup-chooser"
      aria-labelledby="discovery-setup-chooser-title"
    >
      <h2 id="discovery-setup-chooser-title" className="discovery-panel__title">
        {t('discovery.setup.title')}
      </h2>
      <p className="text-body">{t('discovery.setup.subtitle')}</p>
      <div className="discovery-guided-wizard__intents">
        <button
          type="button"
          className="btn btn-primary"
          data-discovery-setup="guided"
          onClick={onStartGuided}
        >
          {t('discovery.setup.guided')}
        </button>
        <button
          type="button"
          className="btn"
          data-discovery-setup="self-directed"
          onClick={onStartSelfDirected}
        >
          {t('discovery.setup.selfDirected')}
        </button>
      </div>
      <p className="text-meta">{t('discovery.setup.guidedHint')}</p>
    </section>
  );
}
