'use client';

import { motion } from 'framer-motion';
import { AtlasAmbientLayers } from './AtlasAmbientLayers';
import { AtlasHUD } from './AtlasHUD';
import { useAtlasHomeAuth } from './AtlasHomeProvider';
import { AtlasMap } from './AtlasMap';
import { GUEST_LANDING_COPY, GUEST_LANDING_MAP } from './guest-landing-data';
import { useAtlasLoadSequence } from './useAtlasLoadSequence';
import { useAtlasParallax } from './useAtlasParallax';

export function AtlasGuestLanding() {
  const { login } = useAtlasHomeAuth();
  const loadPhase = useAtlasLoadSequence(0);
  const { offset } = useAtlasParallax();
  const uiVisible = loadPhase >= 5;

  return (
    <div className="atlas-guest-landing" data-ui-surface="home-atlas">
      <AtlasAmbientLayers
        loadPhase={loadPhase}
        starsOffset={offset('stars')}
        constellationOffset={offset('constellation')}
      />

      <AtlasHUD />

      <main className="atlas-guest-landing__main">
        <div className="atlas-guest-landing__stage">
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
                onClick={login}
              >
                {GUEST_LANDING_COPY.cta}
                <span aria-hidden="true">→</span>
              </button>
              <button type="button" className="atlas-slide__secondary" onClick={login}>
                {GUEST_LANDING_COPY.secondary}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </motion.div>

          <motion.div
            className="atlas-guest-landing__map-hero"
            style={{
              transform: `translate(${offset('map').x}px, ${offset('map').y}px)`,
            }}
          >
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
