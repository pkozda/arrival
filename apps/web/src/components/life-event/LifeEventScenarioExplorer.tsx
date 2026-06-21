'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProfilePrefillBanner } from '@/components/ProfilePrefillBanner';
import { ModuleExecutionPanel } from '@/components/ModuleExecutionPanel';
import { ResultPanel } from '@/components/ResultPanel';
import { SchemaForm } from '@/components/SchemaForm';
import { useApp } from '@/components/AppProvider';
import { executeModule, fetchModuleSchema } from '@/lib/api';
import {
  deriveDefaultValues,
  extractSchemaFields,
  type PublicModuleContract,
} from '@/lib/product-contract';
import { mergeUserProfileIntoDefaults } from '@/lib/mutations';
import { selectUserContextProfile } from '@/lib/user-context';
import { resolvePrefillConfidenceMessage } from '@/lib/profile-insights';
import { createLifeEventSchemaLabelResolver } from '@/lib/life-event/content-labels';
import { buildInputFromFormData, stableFormDefaultsKey } from '@/lib/schema-form-utils';
import { profilePrefillApplied } from '@/lib/situation-utils';
import { useModuleSnapshot } from '@/lib/snapshot';
import { useExplainExecutionId } from '@/lib/useModuleExplanation';

const MODULE_ID = 'life-event';

type Props = {
  contract: PublicModuleContract;
  initialScenarioEvent?: string;
  embeddedInPanel?: boolean;
};

export function LifeEventScenarioExplorer({
  contract,
  initialScenarioEvent,
  embeddedInPanel = false,
}: Props) {
  const { sessionId, language, t, refreshSessionState, userContext, profileInsights } = useApp();
  const userProfile = selectUserContextProfile(userContext);
  const uiState = useModuleSnapshot(MODULE_ID);
  const { executionId, registerExecution } = useExplainExecutionId(uiState.executionId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [schemaError, setSchemaError] = useState<string>();
  const [fields, setFields] = useState<ReturnType<typeof extractSchemaFields>>([]);
  const [schemaDefaults, setSchemaDefaults] = useState<Record<string, unknown>>({});
  const [defaults, setDefaults] = useState<Record<string, unknown>>({});

  const showProfilePrefillBanner = useMemo(
    () => profilePrefillApplied(schemaDefaults, defaults),
    [schemaDefaults, defaults]
  );
  const prefillMessageKey = useMemo(
    () => resolvePrefillConfidenceMessage(profileInsights),
    [profileInsights]
  );
  const prefillMessage = t(prefillMessageKey);

  const schemaLabelResolver = useMemo(() => createLifeEventSchemaLabelResolver(t), [t]);

  useEffect(() => {
    let cancelled = false;

    fetchModuleSchema(MODULE_ID)
      .then((schema) => {
        if (cancelled) {
          return;
        }

        const nextSchemaDefaults = deriveDefaultValues(schema.inputSchema);
        const mergedDefaults = mergeUserProfileIntoDefaults(nextSchemaDefaults, userProfile);
        if (initialScenarioEvent) {
          mergedDefaults.event = initialScenarioEvent;
        }
        setFields(extractSchemaFields(schema.inputSchema));
        setSchemaDefaults(nextSchemaDefaults);
        setDefaults(mergedDefaults);
        setSchemaError(undefined);
      })
      .catch((fetchError) => {
        if (cancelled) {
          return;
        }
        setSchemaError(fetchError instanceof Error ? fetchError.message : t('life-event.explorer.schemaError'));
      });

    return () => {
      cancelled = true;
    };
  }, [userProfile, initialScenarioEvent, t]);

  const formKey = useMemo(
    () => `${MODULE_ID}-${uiState.snapshotVersion}-${stableFormDefaultsKey(defaults)}`,
    [uiState.snapshotVersion, defaults]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);

    const submitInput = buildInputFromFormData(new FormData(event.currentTarget), fields);

    try {
      const response = await executeModule(
        MODULE_ID,
        submitInput,
        { userProfile: { language } },
        sessionId ?? undefined
      );

      if (response.projection.status === 'error') {
        setError(response.projection.error?.message ?? t('common.error'));
      } else {
        registerExecution(response.meta?.executionId);
        await refreshSessionState();
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className={`le-explorer${embeddedInPanel ? ' le-explorer--embedded' : ' card'}`}
      aria-labelledby={embeddedInPanel ? undefined : 'le-explorer-title'}
    >
      {!embeddedInPanel && (
        <header className="le-explorer__header">
          <span className="le-explorer__badge">{t('life-event.explorer.simulationBadge')}</span>
          <h2 id="le-explorer-title" className="le-explorer__title">
            {t('life-event.explorer.title')}
          </h2>
          <p className="le-explorer__description">{t('life-event.explorer.description')}</p>
        </header>
      )}

      <div className="le-explorer__grid">
        {schemaError ? (
          <div style={{ color: 'var(--color-danger)' }} role="alert">
            {schemaError}
          </div>
        ) : (
          <>
            <ProfilePrefillBanner visible={showProfilePrefillBanner} message={prefillMessage} />
            <SchemaForm
              key={formKey}
              fields={fields}
              defaults={defaults}
              disabled={loading || uiState.isStale}
              submitLabel={loading ? t('common.loading') : t('life-event.explorer.submit')}
              labelResolver={schemaLabelResolver}
              onSubmit={handleSubmit}
            />
          </>
        )}

        <ResultPanel loading={loading || uiState.isStale} error={error}>
          <ModuleExecutionPanel
            moduleId={MODULE_ID}
            contract={contract}
            sessionId={sessionId}
            executionId={executionId}
            projection={uiState.projection}
          />
        </ResultPanel>
      </div>
    </section>
  );
}
