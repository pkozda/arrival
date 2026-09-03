'use client';

import { AtlasSecondaryButton } from '@/components/atlas-runtime';
import { useApp } from '@/components/AppProvider';
import { formatScheduleSummary, type DiscoveryProfile, type ProfileRunSummary } from '@/lib/discovery';
import type { RunNowUiStatus } from '@/lib/discovery/useDiscoveryModule';
import { DiscoveryNotificationField } from './DiscoveryNotificationField';

type Props = {
  profile: DiscoveryProfile;
  runSummary: ProfileRunSummary | null;
  resultsCount: number;
  runNowStatus: RunNowUiStatus;
  runNowError: string | null;
  emailRecipientConfigured: boolean | null;
  userNotificationEmail: string | null;
  userNotificationEmailKnown: boolean;
  userNotificationEmailLoading: boolean;
  userNotificationEmailLoadError: string | null;
  notificationEmailSaving: boolean;
  notificationEmailError: string | null;
  /** When create/edit form is open, avoid duplicating the full Delivery block. */
  configurationOpen?: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  onEdit: () => void;
  onRunNow: () => void;
};

function criteriaBucket(
  title: string,
  items: Array<{ key: string; value: string | number | boolean | null }>
) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-label">{title}</h3>
      <ul className="discovery-criteria-list">
        {items.map((item) => (
          <li key={`${item.key}-${String(item.value)}`}>
            {item.key}: {String(item.value)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DiscoveryProfilePanel({
  profile,
  runSummary,
  resultsCount,
  runNowStatus,
  runNowError,
  emailRecipientConfigured,
  userNotificationEmail,
  userNotificationEmailKnown,
  userNotificationEmailLoading,
  userNotificationEmailLoadError,
  notificationEmailSaving,
  notificationEmailError,
  configurationOpen = false,
  onToggleEnabled,
  onEdit,
  onRunNow,
}: Props) {
  const { t } = useApp();
  const lastRun = runSummary?.lastRun;
  const zeroNew =
    lastRun?.status === 'SUCCESS' && resultsCount === 0 && lastRun.finishedAt;
  const scheduleSummary = formatScheduleSummary(profile.schedule, t);
  const recipientConfigured = emailRecipientConfigured === true;
  const recipientKnown = emailRecipientConfigured !== null;
  const personalConfigured = userNotificationEmailKnown && userNotificationEmail != null;

  return (
    <section className="discovery-panel" aria-label={profile.name}>
      <div className="discovery-results__row">
        <h2 className="text-heading" style={{ margin: 0 }}>
          {profile.name}
        </h2>
        <div className="discovery-actions">
          <AtlasSecondaryButton type="button" onClick={onEdit}>
            {t('discovery.profiles.edit')}
          </AtlasSecondaryButton>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!profile.enabled || runNowStatus === 'running'}
            data-ui-surface="discovery-run-now"
            onClick={onRunNow}
          >
            {runNowStatus === 'running'
              ? t('discovery.runNow.running')
              : t('discovery.runNow.button')}
          </button>
          {profile.enabled ? (
            <AtlasSecondaryButton type="button" onClick={() => onToggleEnabled(false)}>
              {t('discovery.profiles.disable')}
            </AtlasSecondaryButton>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => onToggleEnabled(true)}>
              {t('discovery.profiles.enable')}
            </button>
          )}
        </div>
      </div>

      {runNowStatus === 'success' ? (
        <p className="discovery-empty" data-ui-surface="discovery-run-now-success">
          {t('discovery.runNow.success')}
        </p>
      ) : null}
      {runNowStatus === 'error' && runNowError ? (
        <p className="discovery-empty" role="alert" data-ui-surface="discovery-run-now-error">
          {t('discovery.runNow.error')} {runNowError}
        </p>
      ) : null}

      <div className="discovery-detail-grid" style={{ marginTop: '1rem' }}>
        <div className="discovery-detail-grid__full">
          <h3 className="discovery-panel__title">{t('discovery.criteria.title')}</h3>
          {criteriaBucket(t('discovery.criteria.required'), profile.criteria.required)}
          {criteriaBucket(t('discovery.criteria.preferred'), profile.criteria.preferred)}
          {criteriaBucket(t('discovery.criteria.excluded'), profile.criteria.excluded)}
          {criteriaBucket(t('discovery.criteria.flexible'), profile.criteria.flexible)}
        </div>
      </div>

      <div className="discovery-schedule-summary" data-ui-surface="discovery-schedule-summary">
        <h3 className="discovery-panel__title">{t('discovery.schedule.title')}</h3>
        <p className="discovery-schedule-summary__value">{scheduleSummary}</p>
      </div>

      {configurationOpen ? (
        <p
          className="text-body text-body--muted discovery-notification__compact"
          data-ui-surface="discovery-notification-compact"
        >
          {t('discovery.notification.compact.editing')}
          {recipientKnown
            ? ` · ${
                recipientConfigured
                  ? t('discovery.notification.compact.deliveryReady')
                  : t('discovery.notification.recipient.notConfigured')
              }`
            : null}
          {personalConfigured
            ? ` · ${t('discovery.notification.compact.personalEmail')}`
            : null}
        </p>
      ) : (
        <div style={{ marginTop: '1rem' }}>
          <DiscoveryNotificationField
            idPrefix="discovery-panel-notification"
            draft={profile.notification}
            onChange={() => undefined}
            emailRecipientConfigured={emailRecipientConfigured}
            userNotificationEmail={userNotificationEmail}
            userNotificationEmailKnown={userNotificationEmailKnown}
            userNotificationEmailLoading={userNotificationEmailLoading}
            userNotificationEmailLoadError={userNotificationEmailLoadError}
            notificationEmailSaving={notificationEmailSaving}
            notificationEmailError={notificationEmailError}
            readOnly
          />
          <p className="text-body text-body--muted discovery-notification__edit-hint">
            {t('discovery.notification.editHint')}
          </p>
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        <h3 className="discovery-panel__title">{t('discovery.runSummary.title')}</h3>
        {!lastRun ? (
          <p className="discovery-empty">{t('discovery.runSummary.none')}</p>
        ) : (
          <dl className="discovery-detail-grid">
            <div>
              <dt>{t('discovery.runSummary.status')}</dt>
              <dd>{lastRun.status}</dd>
            </div>
            <div>
              <dt>{t('discovery.runSummary.started')}</dt>
              <dd>{new Date(lastRun.startedAt).toLocaleString()}</dd>
            </div>
            {lastRun.finishedAt ? (
              <div>
                <dt>{t('discovery.runSummary.finished')}</dt>
                <dd>{new Date(lastRun.finishedAt).toLocaleString()}</dd>
              </div>
            ) : null}
          </dl>
        )}
        {zeroNew ? (
          <p className="discovery-empty" data-ui-surface="discovery-zero-new-run">
            {t('discovery.runSummary.zeroNew')}
          </p>
        ) : null}
      </div>
    </section>
  );
}
