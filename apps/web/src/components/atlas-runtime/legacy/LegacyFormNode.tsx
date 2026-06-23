import type { FormHTMLAttributes, ReactNode } from 'react';

type LegacyFormNodeProps = FormHTMLAttributes<HTMLFormElement> & {
  children: ReactNode;
};

/**
 * Legacy island wrapper — forms inherit cosmic node chrome.
 */
export function LegacyFormNode({ children, className = '', ...props }: LegacyFormNodeProps) {
  return (
    <form
      className={`legacy-form-node ${className}`.trim()}
      data-legacy-island="form"
      {...props}
    >
      {children}
    </form>
  );
}
