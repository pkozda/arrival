'use client';

import { useParams } from 'next/navigation';
import { ContractModulePage } from '@/components/ContractModulePage';
import { Header } from '@/components/Header';
import { useApp } from '@/components/AppProvider';

export default function ModulePage() {
  const params = useParams<{ moduleId: string }>();
  const moduleId = params.moduleId;
  const { modules, modulesLoading, modulesError } = useApp();
  const contract = modules.find((module) => module.id === moduleId);

  if (modulesLoading) {
    return (
      <>
        <Header />
        <main style={{ padding: '2rem 0 4rem' }}>
          <div className="container">
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>Loading module...</div>
          </div>
        </main>
      </>
    );
  }

  if (modulesError) {
    return (
      <>
        <Header />
        <main style={{ padding: '2rem 0 4rem' }}>
          <div className="container">
            <div className="card" style={{ padding: '2rem', color: 'var(--color-danger)' }}>{modulesError}</div>
          </div>
        </main>
      </>
    );
  }

  if (!contract || contract.status !== 'available') {
    return (
      <>
        <Header />
        <main style={{ padding: '2rem 0 4rem' }}>
          <div className="container">
            <div className="card" style={{ padding: '2rem' }}>Module not found.</div>
          </div>
        </main>
      </>
    );
  }

  return <ContractModulePage moduleId={moduleId} contract={contract} />;
}
