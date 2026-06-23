'use client';

import { AtlasLink as Link } from '@/components/atlas-runtime';
import { motion } from 'framer-motion';
import type { AtlasLoadPhase } from './useAtlasLoadSequence';
import type { AtlasSlideDefinition } from './types';

type Props = {
  slide: AtlasSlideDefinition;
  isActive: boolean;
  loadPhase: AtlasLoadPhase;
};

export function AtlasSlide({ slide, isActive, loadPhase }: Props) {
  const uiVisible = loadPhase >= 5;

  return (
    <motion.div
      className="atlas-slide"
      initial={false}
      animate={{
        opacity: isActive && uiVisible ? 1 : 0,
        y: isActive && uiVisible ? 0 : 16,
        pointerEvents: 'none',
      }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      aria-hidden={!isActive}
    >
      <p className="atlas-slide__eyebrow">Personal Life Navigation</p>
      <p className="atlas-slide__index">{slide.label}</p>
      <h1 className="atlas-slide__headline">
        {slide.headline}
        {slide.headlineAccent && (
          <>
            <br />
            <span className="atlas-slide__accent">{slide.headlineAccent}</span>
          </>
        )}
      </h1>
      <p className="atlas-slide__supporting">{slide.supporting}</p>
      <div className="atlas-slide__actions">
        <Link
          href={slide.ctaHref}
          className="atlas-slide__cta"
          data-ui-surface={slide.index === 0 ? 'home-atlas-entry' : undefined}
        >
          {slide.cta}
          <span aria-hidden="true">→</span>
        </Link>
        <Link href="/modules/life-event" className="atlas-slide__secondary">
          See what&apos;s next
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </motion.div>
  );
}
