'use client';

import { useState } from 'react';
import { AtlasSecondaryButton } from '@/components/atlas-runtime';
import { useApp } from '@/components/AppProvider';
import { SurfaceErrorPanel } from '@/components/surface/SurfaceErrorPanel';
import { SurfaceLoadingSkeleton } from '@/components/surface/SurfaceLoadingSkeleton';
import { useSurfaceRetry } from '@/components/surface/useSurfaceRetry';
import {
  buildCreateProfileInput,
  buildUpdateProfileInput,
  criteriaCountry,
  criteriaRole,
  strategyTemplateFromProfile,
  useDiscoveryModule,
  type DiscoveryStrategyTemplate,
} from '@/lib/discovery';
import { DiscoveryProfilePanel } from './DiscoveryProfilePanel';
import { DiscoveryProfileSidebar } from './DiscoveryProfileSidebar';
import { DiscoveryResultDetail } from './DiscoveryResultDetail';
import { DiscoveryResultsList } from './DiscoveryResultsList';

type Props = {
  sessionId?: string;
};

export function DiscoveryPage({ sessionId }: Props) {
  const { t } = useApp();
  const state = useDiscoveryModule(sessionId);
  const { retrying, onRetry } = useSurfaceRetry(state.refetch);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [template, setTemplate] = useState<DiscoveryStrategyTemplate>('jobs');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('DE');
  const [role, setRole] = useState('');

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

  if (state.error && state.profiles.length === 0) {
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

  const handleCreate = async () => {
    if (!name.trim()) return;
    await state.createProfile(
      buildCreateProfileInput({
        template,
        name,
        country,
        role: template === 'jobs' ? role : undefined,
      })
    );
    setCreating(false);
    setName('');
    setRole('');
  };

  const openEditForm = () => {
    if (!state.selectedProfile) return;
    const profile = state.selectedProfile;
    setTemplate(strategyTemplateFromProfile(profile));
    setName(profile.name);
    setCountry(criteriaCountry(profile) || 'DE');
    setRole(criteriaRole(profile));
    setEditing(true);
    setCreating(false);
  };

  const handleUpdate = async () => {
    if (!state.selectedProfile || !name.trim()) return;
    await state.updateProfile(
      state.selectedProfile.id,
      buildUpdateProfileInput({
        template: strategyTemplateFromProfile(state.selectedProfile),
        name,
        country,
        role: strategyTemplateFromProfile(state.selectedProfile) === 'jobs' ? role : undefined,
      })
    );
    setEditing(false);
  };

  return (
    <div className="discovery-module" data-ui-surface="discovery-module-body">
      <header className="discovery-module__header">
        <h1 className="text-heading">{t('discovery.module.title')}</h1>
        <p className="text-body text-body--muted">{t('discovery.module.subtitle')}</p>
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
            onCreateClick={() => setCreating((open) => !open)}
            creating={creating}
          />

          {creating ? (
            <section className="discovery-panel" aria-label={t('discovery.create.title')}>
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
                  <label>
                    {t('discovery.create.role')}
                    <input value={role} onChange={(event) => setRole(event.target.value)} />
                  </label>
                ) : null}
                <div className="discovery-create-form__actions">
                  <button type="submit" className="btn btn-primary">
                    {t('discovery.create.submit')}
                  </button>
                  <AtlasSecondaryButton type="button" onClick={() => setCreating(false)}>
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
                  <label>
                    {t('discovery.create.role')}
                    <input value={role} onChange={(event) => setRole(event.target.value)} />
                  </label>
                ) : null}
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
          {state.selectedProfile ? (
            <>
              <DiscoveryProfilePanel
                profile={state.selectedProfile}
                runSummary={state.runSummary}
                resultsCount={state.results.length}
                runNowStatus={state.runNowStatus}
                runNowError={state.runNowError}
                onToggleEnabled={(enabled) =>
                  void state.setProfileEnabled(state.selectedProfile!.id, enabled)
                }
                onEdit={openEditForm}
                onRunNow={() => void state.runNow()}
              />
              <div className="discovery-module__layout" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <DiscoveryResultsList
                  results={state.results}
                  selectedResultId={state.selectedResultId}
                  onSelect={(id) => void state.selectResult(id)}
                />
                <DiscoveryResultDetail
                  result={state.selectedResult}
                  stateUpdateError={state.stateUpdateError}
                  stateUpdating={state.stateUpdating}
                  onUserState={(userState) => void state.updateUserState(userState)}
                />
              </div>
            </>
          ) : (
            <section className="discovery-panel">
              <p className="discovery-empty">{t('discovery.empty.profiles')}</p>
              <p className="discovery-empty">{t('discovery.empty.profilesHint')}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
