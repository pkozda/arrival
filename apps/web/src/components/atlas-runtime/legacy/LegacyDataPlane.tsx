import type { ReactNode } from 'react';

type LegacyDataPlaneProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Legacy island wrapper — tables and data-dense views in cosmic data plane.
 */
export function LegacyDataPlane({ children, className = '' }: LegacyDataPlaneProps) {
  return (
    <div className={`legacy-data-plane ${className}`.trim()} data-legacy-island="data">
      {children}
    </div>
  );
}
