'use client';

import { EmploymentDualTrackView } from '@/components/employment/EmploymentDualTrackView';

export default function EmploymentModulePage() {
  return (
    <main className="celestial-page-main">
      <div className="container" style={{ maxWidth: '720px' }}>
        <EmploymentDualTrackView />
      </div>
    </main>
  );
}
