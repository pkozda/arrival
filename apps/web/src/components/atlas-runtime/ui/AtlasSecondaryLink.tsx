'use client';

import type { ComponentProps, ReactNode } from 'react';
import { AtlasLink } from './AtlasLink';

type Props = ComponentProps<typeof AtlasLink> & {
  children: ReactNode;
  compact?: boolean;
};

/** Unified Atlas secondary action as a navigation link. */
export function AtlasSecondaryLink({
  className = '',
  compact = false,
  children,
  ...props
}: Props) {
  const classes = [
    'btn',
    'atlas-secondary-button',
    compact ? 'atlas-secondary-button--compact' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <AtlasLink className={classes} {...props}>
      {children}
    </AtlasLink>
  );
}
