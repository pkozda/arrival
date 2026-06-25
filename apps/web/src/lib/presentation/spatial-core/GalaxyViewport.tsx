'use client';

import { useEffect, type ReactNode } from 'react';
import { JourneyGuideLayer, JourneyGuideProvider, useOptionalJourneyGuideContext } from '@/lib/journey-guide';
import { GalaxyProgressProvider } from './GalaxyProgressProvider';

function GalaxyViewportShell({
  children,
  label,
  surfaceId,
}: {
  children: ReactNode;
  label: string;
  surfaceId: string;
}) {
  const guide = useOptionalJourneyGuideContext();

  return (
    <div
      className={`le-galaxy-viewport${guide?.ambientDimActive ? ' is-guide-focus-active' : ''}${
        guide?.routePreview ? ' is-route-preview-active' : ''
      }`}
      data-ui-surface={surfaceId}
    >
      <div className="le-galaxy-viewport__chrome" aria-hidden="true">
        <span className="le-galaxy-viewport__label">{label}</span>
      </div>
      <div className="le-galaxy-viewport__world">{children}</div>
      <JourneyGuideLayer />
    </div>
  );
}

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
      <JourneyGuideProvider surfaceId={surfaceId}>
        <GalaxyViewportShell label={label} surfaceId={surfaceId}>
          {children}
        </GalaxyViewportShell>
      </JourneyGuideProvider>
    </GalaxyProgressProvider>
  );
}
