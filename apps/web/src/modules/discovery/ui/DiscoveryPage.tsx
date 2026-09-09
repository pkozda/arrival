'use client';

import { useState } from 'react';
import { AtlasSecondaryButton } from '@/components/atlas-runtime';
import { useApp } from '@/components/AppProvider';
import { SurfaceErrorPanel } from '@/components/surface/SurfaceErrorPanel';
import { SurfaceLoadingSkeleton } from '@/components/surface/SurfaceLoadingSkeleton';
import { useSurfaceRetry } from '@/components/surface/useSurfaceRetry';
import {
  DEFAULT_DAILY_HOUR_UTC,
  buildCreateProfileInput,
  buildUpdateProfileInput,
  criteriaCountry,
  criteriaExcludedRoles,
  criteriaRole,
  defaultNotificationDraft,
  defaultScheduleDraft,
  notificationDraftFromProfile,
  scheduleDraftFromProfile,
  strategyTemplateFromProfile,
  useDiscoveryModule,
  type DiscoveryStrategyTemplate,
  type NotificationDraft,
  type ScheduleDraft,
} from '@/lib/discovery';
import { DiscoveryExcludedRolesField } from './DiscoveryExcludedRolesField';
import { DiscoveryGuidedWizard } from './DiscoveryGuidedWizard';
import { DiscoveryNotificationField } from './DiscoveryNotificationField';
import { DiscoveryPersistenceDisclosure } from './DiscoveryPersistenceDisclosure';
import { DiscoveryScheduleField } from './DiscoveryScheduleField';
import { DiscoveryProfilePanel } from './DiscoveryProfilePanel';
import { DiscoveryProfileSidebar } from './DiscoveryProfileSidebar';
import { DiscoveryResultDetail } from './DiscoveryResultDetail';
import { DiscoveryResultsList } from './DiscoveryResultsList';
import { DiscoverySetupChooser } from './DiscoverySetupChooser';

type Props = {
  sessionId?: string;
};

export function DiscoveryPage({ sessionId }: Props) {
  const { t } = useApp();
  const state = useDiscoveryModule(sessionId);
  const { retrying, onRetry } = useSurfaceRetry(state.refetch);
  const [guidedOpen, setGuidedOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [template, setTemplate] = useState<DiscoveryStrategyTemplate>('jobs');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('DE');
  const [role, setRole] = useState('');
  const [excludedRoles, setExcludedRoles] = useState<string[]>([]);
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft>(defaultScheduleDraft);
  const [notificationDraft, setNotificationDraft] = useState<NotificationDraft>(
    defaultNotificationDraft
  );
  const [automationUpdating, setAutomationUpdating] = useState(false);

  if (!sessionId || state.unauthorized) {
    return (
      <div className="discovery-module" data-ui-surface="discovery-module-body">
        <p className="discovery-empty">{t('discovery.error.unauthorized')}</p>
      </div>
    );
  }

  if (state.loading || retrying) {
    return (
      <div className="discovery-module" data-ui-surface="discovery-module-body">
        <SurfaceLoadingSkeleton />
      </div>
    );
  }

  if (state.error && state.profiles.length === 0 && !guidedOpen) {
    return (
      <div className="discovery-module" data-ui-surface="discovery-module-body">
        <SurfaceErrorPanel
          title={t('discovery.error.title')}
          message={state.error}
          onRetry={onRetry}
          retrying={retrying}
          retryLabel={t('common.retry')}
        />
      </div>
    );
  }

  const resetSelfDirectedDraft = () => {
    setExcludedRoles([]);
    setScheduleDraft(defaultScheduleDraft());
    setNotificationDraft(defaultNotificationDraft());
    setName('');
    setRole('');
    setTemplate('jobs');
    setCountry('DE');
  };

  const openSelfDirected = () => {
    setGuidedOpen(false);
    setEditing(false);
    resetSelfDirectedDraft();
    setCreating(true);
  };

  const openGuided = () => {
    setCreating(false);
    setEditing(false);
    setGuidedOpen(true);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await state.createProfile(
        buildCreateProfileInput({
          template,
          name,
          country,
          role: template === 'jobs' ? role : undefined,
          excludedRoles: template === 'jobs' ? excludedRoles : undefined,
          scheduleDraft: template === 'jobs' ? scheduleDraft : undefined,
          notificationDraft,
        })
      );
      setCreating(false);
      resetSelfDirectedDraft();
    } catch {
      // Error surfaced via state.error; keep form open.
    }
  };

  const openEditForm = () => {
    if (!state.selectedProfile) return;
    const profile = state.selectedProfile;
    setTemplate(strategyTemplateFromProfile(profile));
    setName(profile.name);
    setCountry(criteriaCountry(profile) || 'DE');
    setRole(criteriaRole(profile));
    setExcludedRoles(criteriaExcludedRoles(profile));
    setScheduleDraft(scheduleDraftFromProfile(profile.schedule));
    setNotificationDraft(notificationDraftFromProfile(profile));
    setEditing(true);
    setCreating(false);
    setGuidedOpen(false);
  };

  const handleUpdate = async () => {
    if (!state.selectedProfile || !name.trim()) return;
    const templateForUpdate = strategyTemplateFromProfile(state.selectedProfile);
    await state.updateProfile(
      state.selectedProfile.id,
      buildUpdateProfileInput({
        template: templateForUpdate,
        name,
        country,
        role: templateForUpdate === 'jobs' ? role : undefined,
        excludedRoles: templateForUpdate === 'jobs' ? excludedRoles : undefined,
        existingCriteria: state.selectedProfile.criteria,
        scheduleDraft: templateForUpdate === 'jobs' ? scheduleDraft : undefined,
        notificationDraft,
      })
    );
    setEditing(false);
  };

  const handleSetAutomaticExecution = async (enabled: boolean) => {
    if (!state.selectedProfile) return;
    setAutomationUpdating(true);
    try {
      const profile = state.selectedProfile;
      const hourUtc =
        profile.schedule.cadence === 'daily'
          ? profile.schedule.hourUtc
          : DEFAULT_DAILY_HOUR_UTC;
      await state.updateProfile(profile.id, {
        schedule: enabled
          ? { cadence: 'daily', hourUtc }
          : { cadence: 'manual' },
      });
    } finally {
      setAutomationUpdating(false);
    }
  };

  const showChooser = !guidedOpen && !creating && !editing && state.profiles.length === 0;

  return (
    <div className="discovery-module" data-ui-surface="discovery-module-body">
      <header className="discovery-module__header">
        <h1 className="text-heading">{t('discovery.module.title')}</h1>
        <p className="text-body text-body--muted">{t('discovery.module.subtitle')}</p>
        <DiscoveryPersistenceDisclosure
          scope={state.persistenceScope}
          claiming={state.continuityClaiming}
          claimError={state.continuityClaimError}
          claimSuccess={state.continuityClaimSuccess}
          onClaimAccount={
            state.persistenceScope === 'session'
              ? () => void state.claimAccountContinuity()
              : undefined
          }
        />
      </header>

      {state.error ? (
        <SurfaceErrorPanel
          compact
          title={t('discovery.error.title')}
          message={state.error}
          onRetry={onRetry}
          retrying={retrying}
          retryLabel={t('common.retry')}
        />
      ) : null}

      <div className="discovery-module__layout">
        <aside className="discovery-module__sidebar">
          <DiscoveryProfileSidebar
            profiles={state.profiles}
            selectedProfileId={state.selectedProfileId}
            onSelect={(id) => void state.selectProfile(id)}
            onCreateClick={() => {
              if (creating) {
                setCreating(false);
                return;
              }
              openSelfDirected();
            }}
            creating={creating}
            onGuidedClick={openGuided}
            guidedActive={guidedOpen}
          />

          {guidedOpen ? (
            <DiscoveryGuidedWizard
              createProfile={state.createProfile}
              onCancel={() => setGuidedOpen(false)}
              onCreatedContinue={() => setGuidedOpen(false)}
            />
          ) : null}

          {creating ? (
            <section
              className="discovery-panel"
              aria-label={t('discovery.create.title')}
              data-ui-surface="discovery-self-directed-create"
            >
              <h2 className="discovery-panel__title">{t('discovery.create.title')}</h2>
              <form
                className="discovery-create-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleCreate();
                }}
              >
                <label>
                  {t('discovery.strategy.jobs')} / {t('discovery.strategy.giveaways')}
                  <select
                    value={template}
                    onChange={(event) =>
                      setTemplate(event.target.value as DiscoveryStrategyTemplate)
                    }
                  >
                    <option value="jobs">{t('discovery.strategy.jobs')}</option>
                    <option value="giveaways">{t('discovery.strategy.giveaways')}</option>
                  </select>
                </label>
                <label>
                  {t('discovery.create.name')}
                  <input value={name} onChange={(event) => setName(event.target.value)} required />
                </label>
                <label>
                  {t('discovery.create.country')}
                  <input
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    required
                    maxLength={2}
                  />
                </label>
                {template === 'jobs' ? (
                  <>
                    <label>
                      {t('discovery.create.role')}
                      <input value={role} onChange={(event) => setRole(event.target.value)} />
                    </label>
                    <DiscoveryExcludedRolesField
                      idPrefix="discovery-create-excluded"
                      roles={excludedRoles}
                      onChange={setExcludedRoles}
                    />
                    <DiscoveryScheduleField
                      idPrefix="discovery-create-schedule"
                      draft={scheduleDraft}
                      onChange={setScheduleDraft}
                    />
                  </>
                ) : null}
                <DiscoveryNotificationField
                  idPrefix="discovery-create-notification"
                  draft={notificationDraft}
                  onChange={setNotificationDraft}
                  emailRecipientConfigured={state.emailRecipientConfigured}
                  userNotificationEmail={state.userNotificationEmail}
                  userNotificationEmailKnown={state.userNotificationEmailKnown}
                  userNotificationEmailLoading={state.userNotificationEmailLoading}
                  userNotificationEmailLoadError={state.userNotificationEmailLoadError}
                  notificationEmailSaving={state.notificationEmailSaving}
                  notificationEmailError={state.notificationEmailError}
                  onSaveNotificationEmail={async (email) => {
                    await state.setUserNotificationEmail(email);
                  }}
                  onClearNotificationEmail={async () => {
                    await state.setUserNotificationEmail(null);
                  }}
                />
                <div className="discovery-create-form__actions">
                  <button type="submit" className="btn btn-primary">
                    {t('discovery.create.submit')}
                  </button>
                  <AtlasSecondaryButton
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      resetSelfDirectedDraft();
                    }}
                  >
                    {t('discovery.create.cancel')}
                  </AtlasSecondaryButton>
                </div>
              </form>
            </section>
          ) : null}

          {editing && state.selectedProfile ? (
            <section
              className="discovery-panel"
              aria-label={t('discovery.edit.title')}
              data-ui-surface="discovery-edit-profile"
            >
              <h2 className="discovery-panel__title">{t('discovery.edit.title')}</h2>
              <form
                className="discovery-create-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleUpdate();
                }}
              >
                <label>
                  {t('discovery.create.name')}
                  <input value={name} onChange={(event) => setName(event.target.value)} required />
                </label>
                <label>
                  {t('discovery.create.country')}
                  <input
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    required
                    maxLength={2}
                  />
                </label>
                {strategyTemplateFromProfile(state.selectedProfile) === 'jobs' ? (
                  <>
                    <label>
                      {t('discovery.create.role')}
                      <input value={role} onChange={(event) => setRole(event.target.value)} />
                    </label>
                    <DiscoveryExcludedRolesField
                      idPrefix="discovery-edit-excluded"
                      roles={excludedRoles}
                      onChange={setExcludedRoles}
                    />
                    <DiscoveryScheduleField
                      idPrefix="discovery-edit-schedule"
                      draft={scheduleDraft}
                      onChange={setScheduleDraft}
                    />
                  </>
                ) : null}
                <DiscoveryNotificationField
                  idPrefix="discovery-edit-notification"
                  draft={notificationDraft}
                  onChange={setNotificationDraft}
                  emailRecipientConfigured={state.emailRecipientConfigured}
                  userNotificationEmail={state.userNotificationEmail}
                  userNotificationEmailKnown={state.userNotificationEmailKnown}
                  userNotificationEmailLoading={state.userNotificationEmailLoading}
                  userNotificationEmailLoadError={state.userNotificationEmailLoadError}
                  notificationEmailSaving={state.notificationEmailSaving}
                  notificationEmailError={state.notificationEmailError}
                  onSaveNotificationEmail={async (email) => {
                    await state.setUserNotificationEmail(email);
                  }}
                  onClearNotificationEmail={async () => {
                    await state.setUserNotificationEmail(null);
                  }}
                />
                <div className="discovery-create-form__actions">
                  <button type="submit" className="btn btn-primary">
                    {t('discovery.edit.submit')}
                  </button>
                  <AtlasSecondaryButton type="button" onClick={() => setEditing(false)}>
                    {t('discovery.edit.cancel')}
                  </AtlasSecondaryButton>
                </div>
              </form>
            </section>
          ) : null}
        </aside>

        <div className="discovery-module__main">
          {showChooser ? (
            <DiscoverySetupChooser
              onStartGuided={openGuided}
              onStartSelfDirected={openSelfDirected}
            />
          ) : null}

          {guidedOpen && state.profiles.length === 0 ? (
            <section className="discovery-panel">
              <p className="text-body text-body--muted">{t('discovery.guided.sidebarHint')}</p>
            </section>
          ) : null}

          {state.selectedProfile ? (
            <>
              <DiscoveryProfilePanel
                profile={state.selectedProfile}
                runSummary={state.runSummary}
                resultsCount={state.results.length}
                executionLifecycle={state.executionLifecycle}
                runNowError={state.runNowError}
                emailRecipientConfigured={state.emailRecipientConfigured}
                userNotificationEmail={state.userNotificationEmail}
                userNotificationEmailKnown={state.userNotificationEmailKnown}
                userNotificationEmailLoading={state.userNotificationEmailLoading}
                userNotificationEmailLoadError={state.userNotificationEmailLoadError}
                notificationEmailSaving={state.notificationEmailSaving}
                notificationEmailError={state.notificationEmailError}
                persistenceScope={state.persistenceScope}
                automationUpdating={automationUpdating}
                configurationOpen={creating || editing || guidedOpen}
                onToggleEnabled={(enabled) =>
                  void state.setProfileEnabled(state.selectedProfile!.id, enabled)
                }
                onEdit={openEditForm}
                onRunNow={() => void state.runNow()}
                onSetAutomaticExecution={(enabled) => void handleSetAutomaticExecution(enabled)}
              />
              <div className="discovery-module__layout" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <DiscoveryResultsList
                  results={state.results}
                  selectedResultId={state.selectedResultId}
                  executionLifecycle={state.executionLifecycle}
                  currentRunId={state.runSummary?.lastRun?.runId ?? null}
                  onSelect={(id) => void state.selectResult(id)}
                />
                <DiscoveryResultDetail
                  result={state.selectedResult}
                  currentRunId={state.runSummary?.lastRun?.runId ?? null}
                  stateUpdateError={state.stateUpdateError}
                  stateUpdating={state.stateUpdating}
                  onUserState={(userState) => void state.updateUserState(userState)}
                />
              </div>
            </>
          ) : !showChooser && !guidedOpen ? (
            <section className="discovery-panel">
              <p className="discovery-empty">{t('discovery.empty.profiles')}</p>
              <p className="discovery-empty">{t('discovery.empty.profilesHint')}</p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
