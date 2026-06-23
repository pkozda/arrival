'use client';

import type { ReactNode } from 'react';
import { UnifiedAppShell } from './UnifiedAppShell';

type Props = {
  children: ReactNode;
};

/** Root mount point for Atlas UI Runtime Layer (AURL). */
export function AtlasRuntimeRoot({ children }: Props) {
  return <UnifiedAppShell>{children}</UnifiedAppShell>;
}
