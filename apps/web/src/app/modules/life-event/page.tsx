'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { useApp } from '@/components/AppProvider';
import { LifeEventPlanView } from '@/components/life-event/LifeEventPlanView';
import { LifeEventScenarioExplorer } from '@/components/life-event/LifeEventScenarioExplorer';

function LoadingState() {
  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      Loading your plan...
    </div>
  );
}

function LifeEventModulePageContent() {
  const searchParams = useSearchParams();
  const {
    modules,
    modulesLoading,
    modulesError,
    lifeEventPlan,
    lifeEventPlanLoading,
    lifeEventPlanError,
  } = useApp();
  const contract = modules.find((module) => module.id === 'life-event');
  const initialScenarioEvent = searchParams.get('event') ?? undefined;

  if (modulesLoading) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        Loading module...
      </div>
    );
  }

  if (modulesError || !contract || contract.status !== 'available') {
    return (
      <div className="card" style={{ padding: '2rem' }}>
        {modulesError ?? 'Module not found.'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          {contract.title}
        </h1>
        {contract.description && (
          <p style={{ color: 'var(--color-text-muted)', maxWidth: '48rem', lineHeight: 1.6 }}>
            {contract.description}
          </p>
        )}
      </header>

      {lifeEventPlanLoading && <LoadingState />}

      {!lifeEventPlanLoading && lifeEventPlanError && (
        <div className="card" style={{ padding: '1.5rem', color: 'var(--color-text-muted)' }}>
          {lifeEventPlanError}
        </div>
      )}

      {!lifeEventPlanLoading && lifeEventPlan && <LifeEventPlanView plan={lifeEventPlan} />}

      <LifeEventScenarioExplorer contract={contract} initialScenarioEvent={initialScenarioEvent} />
    </div>
  );
}

export default function LifeEventModulePage() {
  return (
    <>
      <Header />
      <main style={{ padding: '2rem 0 4rem' }}>
        <div className="container">
          <Suspense fallback={<LoadingState />}>
            <LifeEventModulePageContent />
          </Suspense>
        </div>
      </main>
    </>
  );
}
