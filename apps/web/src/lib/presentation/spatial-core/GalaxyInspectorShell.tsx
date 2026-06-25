'use client';

import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
};

export function GalaxyInspectorShell({ children, className = '' }: Props) {
  return (
    <aside className={`le-galaxy-hud le-consequence-inspector ${className}`.trim()} aria-live="polite">
      {children}
    </aside>
  );
}
