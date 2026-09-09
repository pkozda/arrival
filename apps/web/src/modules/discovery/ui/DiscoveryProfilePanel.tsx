'use client';

import { AtlasSecondaryButton } from '@/components/atlas-runtime';
import { useApp } from '@/components/AppProvider';
import {
  formatScheduleSummary,
  type DiscoveryExecutionLifecycle,
  type DiscoveryProfile,
  type ProfileRunSummary,
} from '@/lib/discovery';
import { DiscoveryNotificationField } from './DiscoveryNotificationField';
import { DiscoveryAutomationPanel } from './DiscoveryAutomationPanel';
import type { DiscoveryPersistenceScope } from '@/lib/discovery';

type Props = {
  profile: DiscoveryProfile;
  runSummary: ProfileRunSummary | null;
  resultsCount: number;
  executionLifecycle: DiscoveryExecutionLifecycle;
  runNowError: string | null;
  emailRecipientConfigured: boolean | null;
  userNotificationEmail: string | null;
  userNotificationEmailKnown: boolean;
  userNotificationEmailLoading: boolean;
  userNotificationEmailLoadError: string | null;
  notificationEmailSaving: boolean;
  notificationEmailError: string | null;
  persistenceScope: DiscoveryPersistenceScope | null;
  automationUpdating?: boolean;
  /** When create/edit form is open, avoid duplicating the full Delivery block. */
  configurationOpen?: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  onEdit: () => void;
  onRunNow: () => void;
  onSetAutomaticExecution: (enabled: boolean) => void;
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

function lifecycleLabelKey(lifecycle: DiscoveryExecutionLifecycle): string {
  switch (lifecycle) {
    case 'QUEUED':
      return 'discovery.execution.queued';
    case 'RUNNING':
      return 'discovery.execution.running';
    case 'SUCCESS':
      return 'discovery.execution.success';
    case 'NO_RESULTS':
      return 'discovery.execution.noResults';
    case 'ERROR':
      return 'discovery.execution.error';
    default:
      return 'discovery.execution.idle';
  }
}

export function DiscoveryProfilePanel({
  profile,
  runSummary,
  resultsCount,
  executionLifecycle,
  runNowError,
  emailRecipientConfigured,
  userNotificationEmail,
  userNotificationEmailKnown,
  userNotificationEmailLoading,
  userNotificationEmailLoadError,
  notificationEmailSaving,
  notificationEmailError,
  persistenceScope,
  automationUpdating = false,
  configurationOpen = false,
  onToggleEnabled,
  onEdit,
  onRunNow,
  onSetAutomaticExecution,
}: Props) {
  const { t } = useApp();
  const lastRun = runSummary?.lastRun;
  const scheduleSummary = formatScheduleSummary(profile.schedule, t);
  const recipientConfigured = emailRecipientConfigured === true;
  const recipientKnown = emailRecipientConfigured !== null;
  const personalConfigured = userNotificationEmailKnown && userNotificationEmail != null;
  const runActive =
    executionLifecycle === 'QUEUED' || executionLifecycle === 'RUNNING';
  const applicableCount = runSummary?.applicableResultCount ?? 0;

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
            disabled={!profile.enabled || runActive}
            data-ui-surface="discovery-run-now"
            data-execution-lifecycle={executionLifecycle}
            onClick={onRunNow}
          >
            {runActive
              ? t(
                  executionLifecycle === 'QUEUED'
                    ? 'discovery.runNow.queued'
                    : 'discovery.runNow.running'
                )
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

      <p
        className="discovery-empty"
        data-ui-surface="discovery-execution-lifecycle"
        data-lifecycle={executionLifecycle}
        role="status"
      >
        {t(lifecycleLabelKey(executionLifecycle))}
        {executionLifecycle === 'SUCCESS' && applicableCount > 0
          ? ` (${applicableCount})`
          : null}
      </p>

      {executionLifecycle === 'NO_RESULTS' ? (
        <div data-ui-surface="discovery-execution-no-results">
          <p className="discovery-empty">{t('discovery.execution.noResultsDetail')}</p>
          <div className="discovery-actions">
            <AtlasSecondaryButton type="button" onClick={onEdit}>
              {t('discovery.execution.adjustProfile')}
            </AtlasSecondaryButton>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!profile.enabled || runActive}
              onClick={onRunNow}
              data-ui-surface="discovery-execution-run-again"
            >
              {t('discovery.execution.runAgain')}
            </button>
          </div>
        </div>
      ) : null}

      {executionLifecycle === 'ERROR' ? (
        <div data-ui-surface="discovery-execution-error">
          <p className="discovery-empty" role="alert">
            {t('discovery.execution.errorDetail')}
            {runNowError ? ` ${runNowError}` : null}
          </p>
          <AtlasSecondaryButton
            type="button"
            disabled={!profile.enabled || runActive}
            onClick={onRunNow}
            data-ui-surface="discovery-execution-retry"
          >
            {t('discovery.execution.retry')}
          </AtlasSecondaryButton>
        </div>
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

      <div style={{ marginTop: '1rem' }}>
        <DiscoveryAutomationPanel
          profile={profile}
          runSummary={runSummary}
          persistenceScope={persistenceScope}
          automationUpdating={automationUpdating}
          onSetAutomaticExecution={onSetAutomaticExecution}
          onEditDelivery={onEdit}
        />
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
          <p className="discovery-empty" data-ui-surface="discovery-run-summary-none">
            {t('discovery.runSummary.none')}
          </p>
        ) : (
          <dl className="discovery-detail-grid" data-ui-surface="discovery-run-summary">
            <div>
              <dt>{t('discovery.runSummary.status')}</dt>
              <dd data-lifecycle={executionLifecycle}>{t(lifecycleLabelKey(executionLifecycle))}</dd>
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
            <div>
              <dt>{t('discovery.runSummary.resultsForRun')}</dt>
              <dd>{applicableCount}</dd>
            </div>
          </dl>
        )}
        {resultsCount > 0 && executionLifecycle === 'SUCCESS' ? (
          <p className="text-body text-body--muted" data-ui-surface="discovery-results-hint">
            {t('discovery.execution.resultsAvailable')}
          </p>
        ) : null}
      </div>
    </section>
  );
}
