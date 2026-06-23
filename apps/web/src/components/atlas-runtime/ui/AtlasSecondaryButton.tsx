'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

/** Unified Atlas secondary button — visual only. */
export function AtlasSecondaryButton({
  className = '',
  children,
  type = 'button',
  ...props
}: Props) {
  return (
    <button type={type} className={`btn atlas-secondary-button ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
