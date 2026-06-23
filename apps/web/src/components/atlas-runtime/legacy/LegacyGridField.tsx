import type { ReactNode } from 'react';

type LegacyGridFieldProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Legacy island wrapper — dashboard / page layouts embedded in spatial field.
 */
export function LegacyGridField({ children, className = '' }: LegacyGridFieldProps) {
  return (
    <div className={`legacy-grid-field ${className}`.trim()} data-legacy-island="grid">
      {children}
    </div>
  );
}
