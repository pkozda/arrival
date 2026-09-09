'use client';

import { AtlasSecondaryButton } from '@/components/atlas-runtime';
import { useApp } from '@/components/AppProvider';
import type {
  DiscoveryPersistenceScope,
  DiscoveryProfile,
  ProfileRunSummary,
} from '@/lib/discovery';

type Props = {
  profile: DiscoveryProfile;
  runSummary: ProfileRunSummary | null;
  persistenceScope: DiscoveryPersistenceScope | null;
  automationUpdating?: boolean;
  onSetAutomaticExecution: (enabled: boolean) => void;
  onEditDelivery: () => void;
};

export function DiscoveryAutomationPanel({
  profile,
  runSummary,
  persistenceScope,
  automationUpdating = false,
  onSetAutomaticExecution,
  onEditDelivery,
}: Props) {
  const { t } = useApp();
  const automation = runSummary?.automation;
  const isJobs = profile.strategyId === 'job-discovery';
  const cadence = automation?.cadence ?? profile.schedule.cadence;
  const automatic = cadence === 'daily' && profile.enabled;
  const nextRunAt = automation?.nextRunAt ?? null;
  const lastTrigger = automation?.lastRunTrigger;
  const emailEnabled = automation?.delivery.emailEnabled ?? profile.notification.emailEnabled;
  const skipEmpty = automation?.delivery.skipEmptyDigest ?? profile.notification.skipEmptyDigest;
  const sessionScoped = persistenceScope === 'session';

  return (
    <section
      className="discovery-automation"
      aria-label={t('discovery.automation.title')}
      data-ui-surface="discovery-automation"
      data-automatic={automatic ? 'true' : 'false'}
      data-cadence={cadence}
    >
      <h3 className="discovery-panel__title">{t('discovery.automation.title')}</h3>
      <p className="text-body text-body--muted">{t('discovery.automation.subtitle')}</p>

      {sessionScoped ? (
        <p
          className="text-body text-body--muted"
          role="note"
          data-ui-surface="discovery-automation-session-warning"
        >
          {t('discovery.automation.sessionWarning')}
        </p>
      ) : (
        <p className="text-body text-body--muted" data-ui-surface="discovery-automation-account-note">
          {t('discovery.automation.accountNote')}
        </p>
      )}

      <dl className="discovery-detail-grid" style={{ marginTop: '0.75rem' }}>
        <div>
          <dt>{t('discovery.automation.status')}</dt>
          <dd data-ui-surface="discovery-automation-status">
            {automatic
              ? t('discovery.automation.status.on')
              : t('discovery.automation.status.off')}
          </dd>
        </div>
        <div>
          <dt>{t('discovery.automation.cadence')}</dt>
          <dd data-ui-surface="discovery-automation-cadence">
            {cadence === 'daily'
              ? t('discovery.schedule.daily')
              : cadence === 'weekly'
                ? t('discovery.schedule.weeklyUnsupported')
                : t('discovery.schedule.manual')}
          </dd>
        </div>
        {nextRunAt ? (
          <div>
            <dt>{t('discovery.automation.nextRun')}</dt>
            <dd data-ui-surface="discovery-automation-next-run">
              {new Date(nextRunAt).toLocaleString()}
            </dd>
          </div>
        ) : (
          <div>
            <dt>{t('discovery.automation.nextRun')}</dt>
            <dd data-ui-surface="discovery-automation-next-run-none">
              {t('discovery.automation.nextRunNone')}
            </dd>
          </div>
        )}
        {lastTrigger ? (
          <div>
            <dt>{t('discovery.automation.lastTrigger')}</dt>
            <dd data-ui-surface="discovery-automation-last-trigger">
              {lastTrigger === 'scheduled'
                ? t('discovery.automation.trigger.scheduled')
                : t('discovery.automation.trigger.manual')}
            </dd>
          </div>
        ) : null}
        <div>
          <dt>{t('discovery.automation.delivery')}</dt>
          <dd data-ui-surface="discovery-automation-delivery">
            {!emailEnabled
              ? t('discovery.automation.delivery.off')
              : skipEmpty
                ? t('discovery.automation.delivery.onSkipEmpty')
                : t('discovery.automation.delivery.onIncludeEmpty')}
          </dd>
        </div>
      </dl>

      <p className="text-body text-body--muted" data-ui-surface="discovery-automation-newness-note">
        {t('discovery.automation.newnessNote')}
      </p>
      <p
        className="text-body text-body--muted"
        data-ui-surface="discovery-automation-delivery-failure-note"
      >
        {t('discovery.automation.deliveryFailureNote')}
      </p>

      {isJobs ? (
        <div className="discovery-actions" style={{ marginTop: '0.75rem' }}>
          {automatic ? (
            <AtlasSecondaryButton
              type="button"
              disabled={automationUpdating || !profile.enabled}
              data-ui-surface="discovery-automation-disable"
              onClick={() => onSetAutomaticExecution(false)}
            >
              {t('discovery.automation.disable')}
            </AtlasSecondaryButton>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={automationUpdating || !profile.enabled}
              data-ui-surface="discovery-automation-enable"
              onClick={() => onSetAutomaticExecution(true)}
            >
              {t('discovery.automation.enable')}
            </button>
          )}
          <AtlasSecondaryButton type="button" onClick={onEditDelivery}>
            {t('discovery.automation.editDelivery')}
          </AtlasSecondaryButton>
        </div>
      ) : (
        <p className="text-body text-body--muted" data-ui-surface="discovery-automation-jobs-only">
          {t('discovery.automation.jobsOnly')}
        </p>
      )}
    </section>
  );
}
