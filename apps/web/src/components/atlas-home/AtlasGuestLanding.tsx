'use client';

import { motion } from 'framer-motion';
import { AtlasAmbientLayers } from './AtlasAmbientLayers';
import { AtlasHUD } from './AtlasHUD';
import { useAtlasHomeDemo } from './AtlasHomeProvider';
import { AtlasMap } from './AtlasMap';
import { GUEST_LANDING_COPY, GUEST_LANDING_MAP } from './guest-landing-data';
import { useAtlasLoadSequence } from './useAtlasLoadSequence';
import { useAtlasParallax } from './useAtlasParallax';

export function AtlasGuestLanding() {
  const { enterAtlas } = useAtlasHomeDemo();
  const loadPhase = useAtlasLoadSequence(0);
  const { parallaxRef } = useAtlasParallax();
  const uiVisible = loadPhase >= 5;

  return (
    <div ref={parallaxRef} className="atlas-parallax-root atlas-guest-landing" data-ui-surface="home-atlas">
      <AtlasAmbientLayers loadPhase={loadPhase} />

      <AtlasHUD />

      <main className="atlas-guest-landing__main">
        <div className="atlas-guest-landing__stage">
          <div className="atlas-guest-landing__copy-shell">
            <motion.div
              className="atlas-guest-landing__copy"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: uiVisible ? 1 : 0, y: uiVisible ? 0 : 20 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
            <p className="atlas-slide__eyebrow">{GUEST_LANDING_COPY.eyebrow}</p>
            <h1 className="atlas-slide__headline">
              {GUEST_LANDING_COPY.headline}
              <br />
              <span className="atlas-slide__accent">{GUEST_LANDING_COPY.headlineAccent}</span>
            </h1>
            <p className="atlas-slide__supporting">{GUEST_LANDING_COPY.supporting}</p>
            <div className="atlas-slide__actions">
              <button
                type="button"
                className="atlas-slide__cta"
                data-ui-surface="home-atlas-entry"
                onClick={enterAtlas}
              >
                {GUEST_LANDING_COPY.cta}
                <span aria-hidden="true">→</span>
              </button>
              <button type="button" className="atlas-slide__secondary" onClick={enterAtlas}>
                {GUEST_LANDING_COPY.secondary}
                <span aria-hidden="true">→</span>
              </button>
            </div>
            </motion.div>
          </div>

          <motion.div className="atlas-guest-landing__map-hero">
            <div className="atlas-guest-landing__map-wrap">
              <AtlasMap
                slide={GUEST_LANDING_MAP}
                locationLabel=""
                loadPhase={loadPhase}
                parallaxOffset={{ x: 0, y: 0 }}
                interactive={false}
              />
            </div>
          </motion.div>
        </div>

        <div className="atlas-guest-landing__footer" aria-hidden="true">
          <span className="atlas-guest-landing__step">01</span>
          <span className="atlas-guest-landing__footer-track">
            <span className="atlas-guest-landing__footer-fill" />
          </span>
        </div>
      </main>
    </div>
  );
}
