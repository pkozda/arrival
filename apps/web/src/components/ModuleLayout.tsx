'use client';

import { PageHeader } from '@/components/atlas-runtime';

interface ModuleLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function ModuleLayout({ title, description, children }: ModuleLayoutProps) {
  return (
    <main className="celestial-page-main">
      <div className="container">
        <PageHeader eyebrow="Module" title={title} description={description} />
        {children}
      </div>
    </main>
  );
}
