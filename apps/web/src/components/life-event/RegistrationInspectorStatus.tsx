'use client';

import { AtlasSecondaryLink } from '@/components/atlas-runtime';
import { useApp } from '@/components/AppProvider';
import { deriveRegistrationUxState } from '@/lib/life-event/registration-ux-state';

type Props = {
  nodeId: string;
};

/**
 * Registration-specific inspector status for PD-001.
 * Complements (does not replace) the generic galaxy inspector.
 */
export function RegistrationInspectorStatus({ nodeId: _nodeId }: Props) {
  const { t, userContext } = useApp();
  const ux = deriveRegistrationUxState(userContext);

  if (ux.state === 'blocked') {
    return (
      <div className="le-consequence-inspector__section" data-registration-ux="blocked">
        <h4>{t('life-event.registration.inspector.heading')}</h4>
        <p className="le-consequence-inspector__why">
          {t('life-event.registration.inspector.blockedReason')}
        </p>
        <p className="text-caption">{t('life-event.registration.inspector.addressMissing')}</p>
        <p className="text-caption">{t('life-event.registration.inspector.anmeldungNotReady')}</p>
        <div className="le-node-actions" style={{ marginTop: '0.75rem' }}>
          <AtlasSecondaryLink href="/profile/where-you-live/edit" compact>
            {t('life-event.registration.inspector.updateAddress')}
          </AtlasSecondaryLink>
        </div>
      </div>
    );
  }

  if (ux.state === 'complete') {
    return (
      <div className="le-consequence-inspector__section" data-registration-ux="complete">
        <h4>{t('life-event.registration.inspector.heading')}</h4>
        <p className="le-consequence-inspector__why">
          {t('life-event.registration.inspector.complete')}
        </p>
        <p className="text-caption">{t('life-event.registration.inspector.addressComplete')}</p>
        <p className="text-caption">{t('life-event.registration.inspector.anmeldungConfirmed')}</p>
      </div>
    );
  }

  return (
    <div className="le-consequence-inspector__section" data-registration-ux="actionable">
      <h4>{t('life-event.registration.inspector.heading')}</h4>
      <p className="le-consequence-inspector__why">
        {t('life-event.registration.inspector.actionableSummary')}
      </p>
      <p className="text-caption">{t('life-event.registration.inspector.addressComplete')}</p>
      <p className="text-caption">{t('life-event.registration.inspector.anmeldungNotConfirmed')}</p>
      <p className="text-caption">{t('life-event.registration.inspector.nextPrepare')}</p>
      <div className="le-node-actions" style={{ marginTop: '0.75rem' }}>
        <AtlasSecondaryLink href="/modules/life-event/prepare-anmeldung" compact>
          {t('life-event.action.module.anmeldung-preparation')}
        </AtlasSecondaryLink>
        <AtlasSecondaryLink href="/profile/move-to-germany/edit" compact>
          {t('life-event.registration.inspector.confirmWhenDone')}
        </AtlasSecondaryLink>
      </div>
    </div>
  );
}
