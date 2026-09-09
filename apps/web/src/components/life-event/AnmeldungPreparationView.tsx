'use client';

import { AtlasLink as Link } from '@/components/atlas-runtime';
import { AtlasSecondaryButton, AtlasSecondaryLink, PageHeader } from '@/components/atlas-runtime';
import { AtlasSurface } from '@/components/atlas-runtime/legacy';
import { useApp } from '@/components/AppProvider';
import {
  ANMELDUNG_OFFICIAL_GUIDANCE_URL,
  hasAnmeldungOfficialGuidanceUrl,
} from '@/lib/life-event/anmeldung-guidance';
import { deriveRegistrationUxState } from '@/lib/life-event/registration-ux-state';
import { selectUserContextProfile } from '@/lib/user-context';

export function AnmeldungPreparationView() {
  const { t, userContext } = useApp();
  const profile = selectUserContextProfile(userContext);
  const ux = deriveRegistrationUxState(userContext);
  const city = profile?.domains?.housing?.city?.trim();

  const openOfficialGuidance = () => {
    if (!hasAnmeldungOfficialGuidanceUrl() || !ANMELDUNG_OFFICIAL_GUIDANCE_URL) {
      return;
    }
    window.open(ANMELDUNG_OFFICIAL_GUIDANCE_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div data-ui-surface="anmeldung-preparation">
      <PageHeader
        eyebrow={t('life-event.prepare.eyebrow')}
        leading={
          <Link href="/modules/life-event">{t('life-event.prepare.backToPlan')}</Link>
        }
        title={t('life-event.prepare.title')}
        description={t('life-event.prepare.subtitle')}
      />

      <AtlasSurface>
        <section className="le-prepare-section" aria-labelledby="prepare-status">
          <h2 id="prepare-status">{t('life-event.prepare.statusHeading')}</h2>
          {ux.state === 'blocked' && (
            <p className="text-body">{t('life-event.prepare.status.blocked')}</p>
          )}
          {ux.state === 'actionable' && (
            <p className="text-body">
              {city
                ? t('life-event.prepare.status.actionableWithCity').replace('{city}', city)
                : t('life-event.prepare.status.actionable')}
            </p>
          )}
          {ux.state === 'complete' && (
            <p className="text-body">{t('life-event.prepare.status.complete')}</p>
          )}
        </section>

        <section className="le-prepare-section" aria-labelledby="prepare-why">
          <h2 id="prepare-why">{t('life-event.prepare.whyHeading')}</h2>
          <p className="text-body">{t('life-event.prepare.whyBody')}</p>
        </section>

        <section className="le-prepare-section" aria-labelledby="prepare-what">
          <h2 id="prepare-what">{t('life-event.prepare.whatHeading')}</h2>
          <p className="text-body">{t('life-event.prepare.whatBody')}</p>
        </section>

        <section className="le-prepare-section" aria-labelledby="prepare-checklist">
          <h2 id="prepare-checklist">{t('life-event.prepare.checklistHeading')}</h2>
          <ul className="text-body">
            <li>{t('life-event.prepare.checklist.address')}</li>
            <li>{t('life-event.prepare.checklist.id')}</li>
            <li>{t('life-event.prepare.checklist.landlord')}</li>
            <li>{t('life-event.prepare.checklist.appointment')}</li>
          </ul>
          <p className="text-meta">{t('life-event.prepare.checklistNote')}</p>
        </section>

        <section className="le-prepare-section" id="where" aria-labelledby="prepare-where">
          <h2 id="prepare-where">{t('life-event.prepare.whereHeading')}</h2>
          <p className="text-body">{t('life-event.prepare.whereBody')}</p>
          <p className="text-meta">{t('life-event.prepare.externalDisclaimer')}</p>

          {hasAnmeldungOfficialGuidanceUrl() ? (
            <AtlasSecondaryButton type="button" onClick={openOfficialGuidance}>
              {t('life-event.prepare.openOfficialGuidance')}
            </AtlasSecondaryButton>
          ) : (
            <p className="text-body" role="status">
              {t('life-event.prepare.officialGuidancePending')}
            </p>
          )}
        </section>

        <section className="le-prepare-section" aria-labelledby="prepare-return">
          <h2 id="prepare-return">{t('life-event.prepare.returnHeading')}</h2>
          <p className="text-body">{t('life-event.prepare.returnBody')}</p>
          {ux.state === 'blocked' ? (
            <AtlasSecondaryLink href="/profile/where-you-live/edit">
              {t('life-event.prepare.updateAddress')}
            </AtlasSecondaryLink>
          ) : ux.state === 'complete' ? (
            <AtlasSecondaryLink href="/modules/life-event">
              {t('life-event.prepare.backToPlan')}
            </AtlasSecondaryLink>
          ) : (
            <AtlasSecondaryLink href="/profile/move-to-germany/edit">
              {t('life-event.prepare.confirmCompletion')}
            </AtlasSecondaryLink>
          )}
        </section>
      </AtlasSurface>
    </div>
  );
}
