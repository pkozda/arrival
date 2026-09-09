import { describe, expect, it } from 'vitest';
import type { UserContextV1 } from '@/lib/product-contract';
import {
  EMPLOYMENT_JOB_SEARCH_HREF,
  EMPLOYMENT_LANDING_HREF,
  MOVE_TO_GERMANY_EDIT_HREF,
  WORK_INCOME_EDIT_HREF,
  WORK_INCOME_PROFILE_HREF,
  deriveEmploymentDualTrack,
} from './employment-dual-track.js';
import { ATLAS_SLIDES } from '@/components/atlas-home/atlas-data';

function context(partial: {
  employmentStatus?: string;
  grossMonthlyIncome?: number;
  countryOfOrigin?: string;
  residencyStatus?: string;
}): UserContextV1 {
  return {
    schemaVersion: '1.0.0',
    profile: {
      schemaVersion: '1.0.0',
      preferences: {},
      completeness: { score: 0, missingDomains: [] },
      domains: {
        employment: partial.employmentStatus
          ? { employmentStatus: partial.employmentStatus as 'employed' }
          : undefined,
        income:
          partial.grossMonthlyIncome !== undefined
            ? { grossMonthlyIncome: partial.grossMonthlyIncome }
            : undefined,
        migration:
          partial.countryOfOrigin || partial.residencyStatus
            ? {
                countryOfOrigin: partial.countryOfOrigin,
                residencyStatus: partial.residencyStatus as 'eu-citizen' | undefined,
              }
            : undefined,
      },
    },
  };
}

describe('PD-004 Employment dual track', () => {
  it('A — Work & Growth CTA targets Employment landing', () => {
    const workSlide = ATLAS_SLIDES.find((slide) => slide.id === 'growth');
    expect(workSlide?.ctaHref).toBe(EMPLOYMENT_LANDING_HREF);
    expect(workSlide?.ctaHref).not.toBe('/modules/life-event');
  });

  it('B — Work & Income and Job Search are separate tracks', () => {
    const snap = deriveEmploymentDualTrack(context({}));
    expect(snap.workIncomeHref).not.toBe(snap.jobSearchHref);
    expect(snap.jobSearchHref).toBe(EMPLOYMENT_JOB_SEARCH_HREF);
  });

  it('C — known employment is current state', () => {
    const snap = deriveEmploymentDualTrack(
      context({
        employmentStatus: 'employed',
        countryOfOrigin: 'UA',
        residencyStatus: 'eu-citizen',
        grossMonthlyIncome: 2800,
      })
    );
    expect(snap.situationKind).toBe('known');
    expect(snap.employmentStatus).toBe('employed');
    expect(snap.hasIncomeInfo).toBe(true);
    expect(snap.workIncomeHref).toBe(WORK_INCOME_PROFILE_HREF);
  });

  it('D — missing employment is not_provided, not unemployed', () => {
    const snap = deriveEmploymentDualTrack(
      context({
        countryOfOrigin: 'UA',
        residencyStatus: 'eu-citizen',
      })
    );
    expect(snap.situationKind).toBe('not_provided');
    expect(snap.employmentStatus).toBeNull();
    expect(snap.employmentStatus).not.toBe('unemployed');
    expect(snap.workIncomeHref).toBe(WORK_INCOME_EDIT_HREF);
  });

  it('E — Job Search CTA targets Discovery Jobs', () => {
    expect(deriveEmploymentDualTrack(context({})).jobSearchHref).toBe('/modules/discovery');
  });

  it('F — employment state does not imply job-search intent', () => {
    const unemployed = deriveEmploymentDualTrack(
      context({
        employmentStatus: 'unemployed',
        countryOfOrigin: 'UA',
        residencyStatus: 'eu-citizen',
      })
    );
    const employed = deriveEmploymentDualTrack(
      context({
        employmentStatus: 'employed',
        countryOfOrigin: 'UA',
        residencyStatus: 'eu-citizen',
      })
    );
    const unknown = deriveEmploymentDualTrack(context({}));
    expect(unemployed.impliesJobSearchIntent).toBe(false);
    expect(employed.impliesJobSearchIntent).toBe(false);
    expect(unknown.impliesJobSearchIntent).toBe(false);
  });

  it('G — Employment slice never claims Discovery run/results', () => {
    const snap = deriveEmploymentDualTrack(
      context({
        employmentStatus: 'employed',
        countryOfOrigin: 'UA',
        residencyStatus: 'eu-citizen',
      })
    );
    expect(snap.claimsDiscoveryRun).toBe(false);
    expect(snap.claimsDiscoveryResults).toBe(false);
  });

  it('locked Work & Income explains unlock via Move to Germany', () => {
    const snap = deriveEmploymentDualTrack(context({ employmentStatus: 'employed' }));
    expect(snap.workIncomeAccess).toBe('locked');
    expect(snap.unlockHref).toBe(MOVE_TO_GERMANY_EDIT_HREF);
    expect(snap.workIncomeHref).toBe(MOVE_TO_GERMANY_EDIT_HREF);
    // Job Search remains available regardless of lock.
    expect(snap.jobSearchHref).toBe(EMPLOYMENT_JOB_SEARCH_HREF);
  });
});
