'use client';

import { AtlasSecondaryButton } from '@/components/atlas-runtime';
import { useApp } from '@/components/AppProvider';
import type { DiscoveryProfile } from '@/lib/discovery';

type Props = {
  profiles: DiscoveryProfile[];
  selectedProfileId: string | null;
  onSelect: (profileId: string) => void;
  onCreateClick: () => void;
  creating: boolean;
};

function strategyLabel(strategyId: string, t: (key: string) => string): string {
  if (strategyId === 'giveaway-discovery') {
    return t('discovery.strategy.giveawayDiscovery');
  }
  return t('discovery.strategy.jobDiscovery');
}

export function DiscoveryProfileSidebar({
  profiles,
  selectedProfileId,
  onSelect,
  onCreateClick,
  creating,
}: Props) {
  const { t } = useApp();

  return (
    <section className="discovery-panel" aria-label={t('discovery.profiles.title')}>
      <div className="discovery-results__row">
        <h2 className="discovery-panel__title">{t('discovery.profiles.title')}</h2>
        <AtlasSecondaryButton type="button" onClick={onCreateClick} aria-pressed={creating}>
          {t('discovery.profiles.create')}
        </AtlasSecondaryButton>
      </div>

      {profiles.length === 0 ? (
        <p className="discovery-empty">{t('discovery.empty.profiles')}</p>
      ) : (
        <ul className="discovery-profile-list">
          {profiles.map((profile) => (
            <li key={profile.id} className="discovery-profile-list__item">
              <button
                type="button"
                className="discovery-profile-list__button"
                aria-current={profile.id === selectedProfileId ? 'true' : undefined}
                onClick={() => onSelect(profile.id)}
              >
                <strong>{profile.name}</strong>
                <div className="discovery-profile-list__meta">
                  <span>{strategyLabel(profile.strategyId, t)}</span>
                  <span
                    className={`discovery-badge ${
                      profile.enabled ? 'discovery-badge--enabled' : 'discovery-badge--disabled'
                    }`}
                  >
                    {profile.enabled
                      ? t('discovery.profiles.enabled')
                      : t('discovery.profiles.disabled')}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
