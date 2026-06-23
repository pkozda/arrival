'use client';

import type { ReactNode } from 'react';

type Props = {
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  leading,
  trailing,
  children,
  className = '',
}: Props) {
  return (
    <header className={`page-header ${className}`.trim()}>
      {leading && <div className="page-header__leading">{leading}</div>}
      {eyebrow && <p className="page-header__eyebrow text-eyebrow">{eyebrow}</p>}
      <div className={trailing ? 'page-header__title-row' : undefined}>
        <h1 className="page-header__title text-page-title">{title}</h1>
        {trailing}
      </div>
      {description && (
        <p className="page-header__description text-body text-body--muted">{description}</p>
      )}
      {children && <div className="page-header__actions">{children}</div>}
    </header>
  );
}
