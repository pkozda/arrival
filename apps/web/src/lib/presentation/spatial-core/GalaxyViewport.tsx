'use client';

import { useEffect, type ReactNode } from 'react';
import { GalaxyProgressProvider } from './GalaxyProgressProvider';

type Props = {
  children: ReactNode;
  label?: string;
  surfaceId?: string;
};

/**
 * Fullscreen spatial stage — single owner of viewport scroll lock.
 */
export function GalaxyViewport({
  children,
  label = 'Life Events',
  surfaceId = 'life-event-galaxy',
}: Props) {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, []);

  return (
    <GalaxyProgressProvider>
      <div className="le-galaxy-viewport" data-ui-surface={surfaceId}>
        <div className="le-galaxy-viewport__chrome" aria-hidden="true">
          <span className="le-galaxy-viewport__label">{label}</span>
        </div>
        <div className="le-galaxy-viewport__world">{children}</div>
      </div>
    </GalaxyProgressProvider>
  );
}
