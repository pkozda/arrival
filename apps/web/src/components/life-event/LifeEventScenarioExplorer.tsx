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
import { buildInputFromFormData, stableFormDefaultsKey } from '@/lib/schema-form-utils';
import { profilePrefillApplied } from '@/lib/situation-utils';
import { useModuleSnapshot } from '@/lib/snapshot';
import { useExplainExecutionId } from '@/lib/useModuleExplanation';

const MODULE_ID = 'life-event';

type Props = {
  contract: PublicModuleContract;
  initialScenarioEvent?: string;
};

export function LifeEventScenarioExplorer({ contract, initialScenarioEvent }: Props) {
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
  const prefillMessage = useMemo(
    () => resolvePrefillConfidenceMessage(profileInsights),
    [profileInsights]
  );

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
        setSchemaError(fetchError instanceof Error ? fetchError.message : 'Unable to load scenarios');
      });

    return () => {
      cancelled = true;
    };
  }, [userProfile, initialScenarioEvent]);

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
    <section className="card">
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        Explore life scenarios
      </h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
        Run a guided scenario for a specific life change. This is separate from your personalized
        plan above.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem' }}>
        {schemaError ? (
          <div style={{ color: 'var(--color-danger)' }}>{schemaError}</div>
        ) : (
          <>
            <ProfilePrefillBanner visible={showProfilePrefillBanner} message={prefillMessage} />
            <SchemaForm
              key={formKey}
              fields={fields}
              defaults={defaults}
              disabled={loading || uiState.isStale}
              submitLabel={loading ? t('common.loading') : t('common.submit')}
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
