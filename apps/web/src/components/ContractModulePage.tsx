'use client';

import { useEffect, useMemo, useState } from 'react';
import { ModuleLayout } from '@/components/ModuleLayout';
import { ModuleExecutionPanel } from '@/components/ModuleExecutionPanel';
import { ResultPanel } from '@/components/ResultPanel';
import { SchemaForm } from '@/components/SchemaForm';
import { useApp } from '@/components/AppProvider';
import { executeModule, fetchModuleSchema } from '@/lib/api';
import {
  deriveDefaultValues,
  extractSchemaFields,
  mergeProfileIntoDefaults,
  type PublicModuleContract,
} from '@/lib/product-contract';
import { buildInputFromFormData } from '@/lib/schema-form-utils';
import { useModuleSnapshot } from '@/lib/snapshot';
import { useExplainExecutionId } from '@/lib/useModuleExplanation';

type Props = {
  moduleId: string;
  contract: PublicModuleContract;
};

export function ContractModulePage({ moduleId, contract }: Props) {
  const { sessionId, language, t, refreshUiSnapshot, uiSnapshot } = useApp();
  const uiState = useModuleSnapshot(moduleId);
  const { executionId, registerExecution } = useExplainExecutionId(uiState.executionId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [schemaError, setSchemaError] = useState<string>();
  const [fields, setFields] = useState<ReturnType<typeof extractSchemaFields>>([]);
  const [defaults, setDefaults] = useState<Record<string, unknown>>({});

  useEffect(() => {
    let cancelled = false;

    fetchModuleSchema(moduleId)
      .then((schema) => {
        if (cancelled) {
          return;
        }

        const schemaDefaults = deriveDefaultValues(schema.inputSchema);
        const mergedDefaults = mergeProfileIntoDefaults(schemaDefaults, uiSnapshot?.profile ?? null);
        setFields(extractSchemaFields(schema.inputSchema));
        setDefaults(mergedDefaults);
        setSchemaError(undefined);
      })
      .catch((fetchError) => {
        if (cancelled) {
          return;
        }
        setSchemaError(fetchError instanceof Error ? fetchError.message : 'Unable to load module schema');
      });

    return () => {
      cancelled = true;
    };
  }, [moduleId, uiSnapshot?.profile]);

  const formKey = useMemo(
    () => `${moduleId}-${uiState.snapshotVersion}-${JSON.stringify(defaults)}`,
    [moduleId, uiState.snapshotVersion, defaults]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);

    const submitInput = buildInputFromFormData(new FormData(event.currentTarget), fields);

    try {
      const response = await executeModule(
        moduleId,
        submitInput,
        { userProfile: { language } },
        sessionId ?? undefined
      );

      if (response.projection.status === 'error') {
        setError(response.projection.error?.message ?? t('common.error'));
      } else {
        registerExecution(response.meta?.executionId);
        await refreshUiSnapshot();
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModuleLayout title={contract.title} description={contract.description}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem' }}>
        {schemaError ? (
          <div className="card" style={{ color: 'var(--color-danger)' }}>{schemaError}</div>
        ) : (
          <SchemaForm
            key={formKey}
            fields={fields}
            defaults={defaults}
            disabled={loading || uiState.isStale}
            submitLabel={loading ? t('common.loading') : t('common.submit')}
            onSubmit={handleSubmit}
          />
        )}

        <ResultPanel loading={loading || uiState.isStale} error={error}>
          <ModuleExecutionPanel
            moduleId={moduleId}
            sessionId={sessionId}
            executionId={executionId}
            projection={uiState.projection}
          />
        </ResultPanel>
      </div>
    </ModuleLayout>
  );
}
