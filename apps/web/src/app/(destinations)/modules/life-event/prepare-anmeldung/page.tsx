'use client';

import { AnmeldungPreparationView } from '@/components/life-event/AnmeldungPreparationView';

export default function PrepareAnmeldungPage() {
  return (
    <main className="celestial-page-main">
      <div className="container" style={{ maxWidth: '720px' }}>
        <AnmeldungPreparationView />
      </div>
    </main>
  );
}
