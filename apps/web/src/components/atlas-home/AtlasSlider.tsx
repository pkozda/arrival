'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ATLAS_SLIDES, getSlideIndexForNode } from './atlas-data';
import { AtlasAmbientLayers } from './AtlasAmbientLayers';
import { AtlasHUD } from './AtlasHUD';
import { AtlasMap } from './AtlasMap';
import { AtlasSidePanel } from './AtlasSidePanel';
import { AtlasSlide } from './AtlasSlide';
import { JourneyTimeline } from './JourneyTimeline';
import { useAtlasLoadSequence } from './useAtlasLoadSequence';
import { useAtlasLocationLabel } from './useAtlasLocationLabel';
import { useAtlasParallax } from './useAtlasParallax';

import type { AtlasNodeId } from './types';

export function AtlasMemberSlider() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadEpoch, setLoadEpoch] = useState(0);
  const locationLabel = useAtlasLocationLabel();
  const loadPhase = useAtlasLoadSequence(loadEpoch);
  const { parallaxRef } = useAtlasParallax();
  const activeSlide = ATLAS_SLIDES[activeIndex];

  const goTo = useCallback((index: number) => {
    setActiveIndex(Math.max(0, Math.min(ATLAS_SLIDES.length - 1, index)));
  }, []);

  const handleNodeSelect = useCallback(
    (nodeId: AtlasNodeId) => {
      goTo(getSlideIndexForNode(nodeId));
    },
    [goTo]
  );

  useEffect(() => {
    setLoadEpoch((value) => value + 1);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        goTo(activeIndex + 1);
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        goTo(activeIndex - 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, goTo]);

  return (
    <div
      ref={parallaxRef}
      className="atlas-parallax-root atlas-slider atlas-slider--authenticated"
      data-ui-surface="home-atlas"
    >
      <AtlasAmbientLayers loadPhase={loadPhase} />

      <AtlasHUD />

      <main className="atlas-slider__main">
        <div className="atlas-slider__stage">
          <motion.div className="atlas-slider__map-hero">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeSlide.id}-${loadEpoch}`}
                className="atlas-slider__map-wrap"
                initial={{ opacity: 0.85, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0.85, scale: 1.01 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                <AtlasMap
                  slide={activeSlide}
                  locationLabel={locationLabel}
                  loadPhase={loadPhase}
                  parallaxOffset={{ x: 0, y: 0 }}
                  interactive
                  onNodeSelect={handleNodeSelect}
                />
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <motion.div className="atlas-slider__ui-left">
            <nav className="atlas-slider__rail" aria-label="Journey slides">
              {ATLAS_SLIDES.map((slide, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    className={`atlas-slider__rail-btn${isActive ? ' is-active' : ''}`}
                    onClick={() => goTo(index)}
                    aria-current={isActive ? 'step' : undefined}
                    aria-label={`Slide ${slide.label}: ${slide.sidePanel.title}`}
                  >
                    <span className="atlas-slider__rail-num">{slide.label}</span>
                    <span className="atlas-slider__rail-line" aria-hidden="true" />
                  </button>
                );
              })}
            </nav>

            <div className="atlas-slider__copy">
              <AnimatePresence mode="wait">
                <AtlasSlide key={activeSlide.id} slide={activeSlide} loadPhase={loadPhase} />
              </AnimatePresence>
            </div>
          </motion.div>

          <motion.div className="atlas-slider__ui-right">
            <AnimatePresence mode="wait">
              <AtlasSidePanel key={activeSlide.id} slide={activeSlide} loadPhase={loadPhase} />
            </AnimatePresence>
          </motion.div>
        </div>

        <JourneyTimeline activeStage={activeSlide.journeyStage} loadPhase={loadPhase} />
      </main>
    </div>
  );
}
