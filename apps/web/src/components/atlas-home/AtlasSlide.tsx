'use client';

import { AtlasLink as Link } from '@/components/atlas-runtime';
import { useApp } from '@/components/AppProvider';
import { motion } from 'framer-motion';
import type { AtlasLoadPhase } from './useAtlasLoadSequence';
import type { AtlasSlideDefinition } from './types';

type Props = {
  slide: AtlasSlideDefinition;
  loadPhase: AtlasLoadPhase;
};

export function AtlasSlide({ slide, loadPhase }: Props) {
  const { t } = useApp();
  const uiVisible = loadPhase >= 5;

  return (
    <motion.div
      className="atlas-slide"
      initial={{ opacity: 0, y: 16 }}
      animate={{
        opacity: uiVisible ? 1 : 0,
        y: uiVisible ? 0 : 16,
        pointerEvents: uiVisible ? 'auto' : 'none',
      }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <p className="atlas-slide__eyebrow">{t('home.atlas.slide.eyebrow')}</p>
      <p className="atlas-slide__index">{slide.label}</p>
      <h1 className="atlas-slide__headline">
        {t(slide.headline)}
        {slide.headlineAccent && (
          <>
            <br />
            <span className="atlas-slide__accent">{t(slide.headlineAccent)}</span>
          </>
        )}
      </h1>
      <p className="atlas-slide__supporting">{t(slide.supporting)}</p>
      <div className="atlas-slide__actions">
        <Link
          href={slide.ctaHref}
          className="atlas-slide__cta"
          data-ui-surface={slide.index === 0 ? 'home-atlas-entry' : undefined}
        >
          {t(slide.cta)}
          <span aria-hidden="true">→</span>
        </Link>
        <Link href="/modules/life-event" className="atlas-slide__secondary">
          {t('home.atlas.slide.secondary')}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </motion.div>
  );
}
