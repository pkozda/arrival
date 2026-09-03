'use client';

import { useEffect, useId, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { AtlasSecondaryButton } from '@/components/atlas-runtime';
import type { NotificationDraft } from '@/lib/discovery';

type Props = {
  draft: NotificationDraft;
  onChange: (draft: NotificationDraft) => void;
  emailRecipientConfigured: boolean | null;
  /** Persisted user email only (never infrastructure fallback). */
  userNotificationEmail: string | null;
  userNotificationEmailKnown: boolean;
  userNotificationEmailLoading: boolean;
  userNotificationEmailLoadError: string | null;
  notificationEmailSaving: boolean;
  notificationEmailError: string | null;
  onSaveNotificationEmail?: (email: string) => Promise<void>;
  onClearNotificationEmail?: () => Promise<void>;
  /** When true, checkboxes and email actions are read-only (status panel). */
  readOnly?: boolean;
  idPrefix?: string;
};

function isPlausibleEmail(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 254 && trimmed.includes('@');
}

/**
 * Delivery / email notification preferences + user notification email.
 * Infrastructure fallback address is never shown — only user-persisted email
 * and opaque delivery-availability status.
 */
export function DiscoveryNotificationField({
  draft,
  onChange,
  emailRecipientConfigured,
  userNotificationEmail,
  userNotificationEmailKnown,
  userNotificationEmailLoading,
  userNotificationEmailLoadError,
  notificationEmailSaving,
  notificationEmailError,
  onSaveNotificationEmail,
  onClearNotificationEmail,
  readOnly = false,
  idPrefix = 'discovery-notification',
}: Props) {
  const { t } = useApp();
  const emailId = `${idPrefix}-email`;
  const skipId = `${idPrefix}-skip`;
  const addressId = `${idPrefix}-address`;
  const errorId = useId();

  const [addressDraft, setAddressDraft] = useState(userNotificationEmail ?? '');
  const [localInvalid, setLocalInvalid] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setAddressDraft(userNotificationEmail ?? '');
    setLocalInvalid(false);
    setJustSaved(false);
  }, [userNotificationEmail]);

  const recipientConfigured = emailRecipientConfigured === true;
  const recipientKnown = emailRecipientConfigured !== null;
  const deliveryGap = draft.emailEnabled && recipientKnown && !recipientConfigured;

  const trimmedDraft = addressDraft.trim();
  const persisted = userNotificationEmail ?? '';
  const dirty = trimmedDraft !== persisted;
  const canSave =
    !readOnly &&
    Boolean(onSaveNotificationEmail) &&
    dirty &&
    trimmedDraft.length > 0 &&
    !notificationEmailSaving &&
    userNotificationEmailKnown;
  const canClear =
    !readOnly &&
    Boolean(onClearNotificationEmail) &&
    userNotificationEmail != null &&
    !notificationEmailSaving &&
    userNotificationEmailKnown;

  async function handleSave() {
    if (!onSaveNotificationEmail || notificationEmailSaving) return;
    if (!isPlausibleEmail(addressDraft)) {
      setLocalInvalid(true);
      return;
    }
    setLocalInvalid(false);
    try {
      await onSaveNotificationEmail(trimmedDraft);
      setJustSaved(true);
    } catch {
      setJustSaved(false);
    }
  }

  async function handleClear() {
    if (!onClearNotificationEmail || notificationEmailSaving) return;
    setLocalInvalid(false);
    setJustSaved(false);
    try {
      await onClearNotificationEmail();
      setAddressDraft('');
    } catch {
      /* keep draft; mutation error shown from hook */
    }
  }

  const fieldError =
    localInvalid
      ? t('discovery.notification.address.invalid')
      : notificationEmailError;

  return (
    <section
      className="discovery-notification"
      aria-label={t('discovery.notification.title')}
      data-ui-surface="discovery-notification-prefs"
    >
      <h3 className="discovery-notification__title">{t('discovery.notification.title')}</h3>

      <label className="discovery-notification__option" htmlFor={emailId}>
        <input
          id={emailId}
          type="checkbox"
          checked={draft.emailEnabled}
          disabled={readOnly}
          onChange={(event) =>
            onChange({ ...draft, emailEnabled: event.target.checked })
          }
        />
        <span>
          {t('discovery.notification.emailEnabled.label')}
          <span className="text-body text-body--muted discovery-notification__hint">
            {t('discovery.notification.emailEnabled.description')}
          </span>
        </span>
      </label>

      <label className="discovery-notification__option" htmlFor={skipId}>
        <input
          id={skipId}
          type="checkbox"
          checked={draft.skipEmptyDigest}
          disabled={readOnly}
          onChange={(event) =>
            onChange({ ...draft, skipEmptyDigest: event.target.checked })
          }
        />
        <span>
          {t('discovery.notification.skipEmptyDigest.label')}
          <span className="text-body text-body--muted discovery-notification__hint">
            {t('discovery.notification.skipEmptyDigest.description')}
          </span>
        </span>
      </label>

      <div
        className="discovery-notification__address"
        data-ui-surface="discovery-notification-address"
      >
        <label className="text-label" htmlFor={addressId}>
          {t('discovery.notification.address.label')}
        </label>
        <p className="text-body text-body--muted discovery-notification__hint">
          {t('discovery.notification.address.description')}
        </p>

        {userNotificationEmailLoading && !userNotificationEmailKnown ? (
          <p
            className="text-body text-body--muted discovery-notification__hint"
            data-ui-surface="discovery-notification-address-loading"
          >
            {t('discovery.notification.address.loading')}
          </p>
        ) : null}

        {userNotificationEmailLoadError && !userNotificationEmailKnown ? (
          <p
            className="text-body discovery-notification__error"
            role="alert"
            data-ui-surface="discovery-notification-address-load-error"
          >
            {t('discovery.notification.address.loadError')}
          </p>
        ) : null}

        {userNotificationEmailKnown ? (
          <>
            {readOnly ? (
              <p className="discovery-notification__address-value">
                {userNotificationEmail ?? t('discovery.notification.address.none')}
              </p>
            ) : (
              <input
                id={addressId}
                type="email"
                autoComplete="email"
                spellCheck={false}
                value={addressDraft}
                disabled={notificationEmailSaving || !userNotificationEmailKnown}
                aria-invalid={Boolean(fieldError)}
                aria-describedby={fieldError ? errorId : undefined}
                data-ui-surface="discovery-notification-address-input"
                onChange={(event) => {
                  setAddressDraft(event.target.value);
                  setLocalInvalid(false);
                  setJustSaved(false);
                }}
              />
            )}

            {!readOnly ? (
              <div className="discovery-notification__address-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!canSave}
                  aria-busy={notificationEmailSaving}
                  data-ui-surface="discovery-notification-address-save"
                  onClick={() => void handleSave()}
                >
                  {t('discovery.notification.address.save')}
                </button>
                {userNotificationEmail != null && !readOnly ? (
                  <AtlasSecondaryButton
                    type="button"
                    disabled={!canClear}
                    data-ui-surface="discovery-notification-address-clear"
                    onClick={() => void handleClear()}
                  >
                    {t('discovery.notification.address.clear')}
                  </AtlasSecondaryButton>
                ) : null}
              </div>
            ) : null}

            {fieldError ? (
              <p
                id={errorId}
                className="text-body discovery-notification__error"
                role="alert"
                data-ui-surface="discovery-notification-address-error"
              >
                {fieldError}
              </p>
            ) : null}

            {justSaved && !fieldError ? (
              <p
                className="text-body text-body--muted discovery-notification__hint"
                data-ui-surface="discovery-notification-address-saved"
              >
                {t('discovery.notification.address.saved')}
              </p>
            ) : null}

            {userNotificationEmailKnown && userNotificationEmail == null ? (
              <p
                className="text-body text-body--muted discovery-notification__hint"
                data-ui-surface="discovery-notification-address-status"
                data-personal-email="false"
                data-delivery-available={recipientConfigured ? 'true' : 'false'}
              >
                {recipientConfigured
                  ? t('discovery.notification.address.systemAvailable')
                  : recipientKnown
                    ? t('discovery.notification.address.unavailable')
                    : null}
              </p>
            ) : null}

            {userNotificationEmailKnown && userNotificationEmail != null ? (
              <p
                className="text-body text-body--muted discovery-notification__hint"
                data-ui-surface="discovery-notification-address-status"
                data-personal-email="true"
              >
                {t('discovery.notification.address.personalConfigured')}
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      {recipientKnown ? (
        <div
          className="discovery-notification__recipient"
          data-ui-surface="discovery-notification-recipient"
          data-recipient-configured={recipientConfigured ? 'true' : 'false'}
          data-email-enabled={draft.emailEnabled ? 'true' : 'false'}
        >
          <p className="discovery-notification__recipient-status">
            <span className="text-label">{t('discovery.notification.recipient.label')}</span>{' '}
            <span>
              {recipientConfigured
                ? t('discovery.notification.recipient.configured')
                : t('discovery.notification.recipient.notConfigured')}
            </span>
          </p>
          {!draft.emailEnabled ? (
            <p className="text-body text-body--muted discovery-notification__hint">
              {t('discovery.notification.emailOff')}
            </p>
          ) : null}
          {deliveryGap ? (
            <p
              className="text-body text-body--muted discovery-notification__hint"
              data-ui-surface="discovery-notification-recipient-gap"
            >
              {t('discovery.notification.recipient.unavailable')}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
