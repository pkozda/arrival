'use client';

import { useApp } from '@/components/AppProvider';
import { companyFromResult, formatMatchPercent, type DiscoveryResultUserView } from '@/lib/discovery';

type Props = {
  results: DiscoveryResultUserView[];
  selectedResultId: string | null;
  onSelect: (resultId: string) => void;
};

function noveltyKey(novelty: DiscoveryResultUserView['changeMetadata']['inferredNovelty']): string {
  switch (novelty) {
    case 'NEW':
      return 'discovery.novelty.new';
    case 'UPDATED':
      return 'discovery.novelty.updated';
    default:
      return 'discovery.novelty.unchanged';
  }
}

function noveltyClass(novelty: DiscoveryResultUserView['changeMetadata']['inferredNovelty']): string {
  switch (novelty) {
    case 'NEW':
      return 'discovery-badge--new';
    case 'UPDATED':
      return 'discovery-badge--updated';
    default:
      return 'discovery-badge--unchanged';
  }
}

export function DiscoveryResultsList({ results, selectedResultId, onSelect }: Props) {
  const { t } = useApp();

  return (
    <section className="discovery-panel" aria-label={t('discovery.results.title')}>
      <h2 className="discovery-panel__title">{t('discovery.results.title')}</h2>

      {results.length === 0 ? (
        <p className="discovery-empty" data-ui-surface="discovery-empty-results">
          {t('discovery.empty.results')}
        </p>
      ) : (
        <div className="discovery-results">
          {results.map((result) => {
            const novelty = result.changeMetadata.inferredNovelty;
            const company = companyFromResult(result);
            return (
              <button
                key={result.id}
                type="button"
                className="discovery-results__item"
                aria-current={result.id === selectedResultId ? 'true' : undefined}
                data-novelty={novelty}
                onClick={() => onSelect(result.id)}
              >
                <div className="discovery-results__row">
                  <strong>{result.canonicalPresentation.title}</strong>
                  <span className={`discovery-badge ${noveltyClass(novelty)}`}>
                    {t(noveltyKey(novelty))}
                  </span>
                </div>
                <div className="discovery-profile-list__meta">
                  <span>
                    {company ? `${company} · ` : ''}
                    {t('discovery.result.matchScore')}: {formatMatchPercent(result.score.matchScore)}
                  </span>
                  <span>{result.userState}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
