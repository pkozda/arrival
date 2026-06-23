import type { CSSProperties, ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

type SurfaceElement = 'div' | 'article' | 'section' | 'aside' | 'details';

type LegacyPanelSurfaceProps<T extends SurfaceElement = 'div'> = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: T;
  /** Preserves legacy .card semantics for tests and existing CSS hooks. */
  asCard?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className' | 'style'>;

/**
 * Legacy island wrapper — cards inherit cosmic glass surface without structural rewrite.
 */
export function LegacyPanelSurface<T extends SurfaceElement = 'div'>({
  children,
  className = '',
  style,
  as,
  asCard = true,
  ...rest
}: LegacyPanelSurfaceProps<T>) {
  const Component = (as ?? 'div') as ElementType;
  const classes = ['legacy-panel-surface', asCard ? 'card' : '', className].filter(Boolean).join(' ');

  return (
    <Component className={classes} style={style} data-legacy-island="panel" {...rest}>
      {children}
    </Component>
  );
}

/** Preferred alias — same cosmic glass surface. */
export const AtlasSurface = LegacyPanelSurface;
