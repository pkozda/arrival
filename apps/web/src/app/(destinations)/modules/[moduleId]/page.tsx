'use client';

import { useParams } from 'next/navigation';
import { ContractModulePage } from '@/components/ContractModulePage';
import { LegacyPanelSurface } from '@/components/atlas-runtime/legacy';
import { useApp } from '@/components/AppProvider';

export default function ModulePage() {
  const params = useParams<{ moduleId: string }>();
  const moduleId = params.moduleId;
  const { modules, modulesLoading, modulesError } = useApp();
  const contract = modules.find((module) => module.id === moduleId);

  if (modulesLoading) {
    return (
      <main className="celestial-page-main">
        <div className="container">
          <LegacyPanelSurface style={{ padding: '2rem', textAlign: 'center' }}>Loading module...</LegacyPanelSurface>
        </div>
      </main>
    );
  }

  if (modulesError) {
    return (
      <main className="celestial-page-main">
        <div className="container">
          <LegacyPanelSurface style={{ padding: '2rem', color: 'var(--color-danger)' }}>{modulesError}</LegacyPanelSurface>
        </div>
      </main>
    );
  }

  if (!contract || contract.status !== 'available') {
    return (
      <main className="celestial-page-main">
        <div className="container">
          <LegacyPanelSurface style={{ padding: '2rem' }}>Module not found.</LegacyPanelSurface>
        </div>
      </main>
    );
  }

  return <ContractModulePage moduleId={moduleId} contract={contract} />;
}
