'use client';

import { AtlasLink as Link } from '@/components/atlas-runtime';
import { AtlasSecondaryLink, PageHeader } from '@/components/atlas-runtime';
import { AtlasSurface } from '@/components/atlas-runtime/legacy';
import { useApp } from '@/components/AppProvider';
import {
  deriveEmploymentDualTrack,
  employmentStatusLabelKey,
} from '@/lib/employment/employment-dual-track';

export function EmploymentDualTrackView() {
  const { t, userContext } = useApp();
  const snap = deriveEmploymentDualTrack(userContext);

  const situationSummary =
    snap.situationKind === 'known' && snap.employmentStatus
      ? t(employmentStatusLabelKey(snap.employmentStatus))
      : t('employment.workIncome.status.notProvided');

  return (
    <div
      data-ui-surface="employment-dual-track"
      data-situation-kind={snap.situationKind}
      data-work-income-access={snap.workIncomeAccess}
      data-implies-job-search-intent={String(snap.impliesJobSearchIntent)}
      data-claims-discovery-run={String(snap.claimsDiscoveryRun)}
    >
      <PageHeader
        eyebrow={t('employment.eyebrow')}
        leading={<Link href="/">{t('employment.backToAtlas')}</Link>}
        title={t('employment.title')}
        description={t('employment.subtitle')}
      />

      <AtlasSurface>
        <section
          className="employment-track"
          data-track="work-income"
          aria-labelledby="employment-work-income"
        >
          <p className="text-eyebrow">{t('employment.track.situation')}</p>
          <h2 id="employment-work-income" className="text-section-title">
            {t('employment.workIncome.title')}
          </h2>
          <p className="text-body">{t('employment.workIncome.description')}</p>
          <p className="text-body" data-work-income-summary>
            <span className="text-meta">{t('employment.workIncome.currentLabel')}</span>{' '}
            {situationSummary}
          </p>
          {snap.hasIncomeInfo && snap.situationKind === 'known' ? (
            <p className="text-meta">{t('employment.workIncome.incomeNoted')}</p>
          ) : null}
          {snap.workIncomeAccess === 'locked' ? (
            <p className="text-body" data-work-income-lock role="status">
              {t('employment.workIncome.locked')}
            </p>
          ) : null}
          <AtlasSecondaryLink href={snap.workIncomeHref} data-cta="work-income">
            {snap.workIncomeAccess === 'locked'
              ? t('employment.workIncome.unlockCta')
              : snap.situationKind === 'known'
                ? t('employment.workIncome.reviewCta')
                : t('employment.workIncome.provideCta')}
          </AtlasSecondaryLink>
        </section>

        <section
          className="employment-track"
          data-track="job-search"
          aria-labelledby="employment-job-search"
        >
          <p className="text-eyebrow">{t('employment.track.capability')}</p>
          <h2 id="employment-job-search" className="text-section-title">
            {t('employment.jobSearch.title')}
          </h2>
          <p className="text-body">{t('employment.jobSearch.description')}</p>
          <p className="text-meta">{t('employment.jobSearch.honesty')}</p>
          <AtlasSecondaryLink
            href={snap.jobSearchHref}
            data-cta="job-search"
            data-job-search-href={snap.jobSearchHref}
          >
            {t('employment.jobSearch.cta')}
          </AtlasSecondaryLink>
        </section>
      </AtlasSurface>
    </div>
  );
}
