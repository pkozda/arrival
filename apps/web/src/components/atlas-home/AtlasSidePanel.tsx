'use client';

import { motion } from 'framer-motion';
import type { AtlasLoadPhase } from './useAtlasLoadSequence';
import type { AtlasSlideDefinition } from './types';

type Props = {
  slide: AtlasSlideDefinition;
  loadPhase: AtlasLoadPhase;
};

export function AtlasSidePanel({ slide, loadPhase }: Props) {
  const { sidePanel } = slide;
  const uiVisible = loadPhase >= 5;

  return (
    <motion.aside
      key={slide.id}
      className="atlas-side-panel"
      initial={{ opacity: 0, x: 32, filter: 'blur(10px)' }}
      animate={{
        opacity: uiVisible ? 1 : 0,
        x: uiVisible ? 0 : 32,
        filter: uiVisible ? 'blur(0px)' : 'blur(10px)',
      }}
      exit={{ opacity: 0, x: 20, filter: 'blur(6px)' }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="atlas-side-panel__glow" aria-hidden="true" />
      <p className="atlas-side-panel__eyebrow">Focus Area</p>
      <h3 className="atlas-side-panel__title">{sidePanel.title}</h3>
      {sidePanel.status && (
        <div className="atlas-side-panel__goal">
          <span className="atlas-side-panel__goal-label">Current Goal</span>
          <p className="atlas-side-panel__status">
            <span className="atlas-side-panel__status-dot" aria-hidden="true" />
            {sidePanel.status}
          </p>
        </div>
      )}
      <div className="atlas-side-panel__section">
        <p className="atlas-side-panel__section-label">
          {sidePanel.tone === 'future' ? 'You can now' : 'Remaining'}
        </p>
        <ul className="atlas-side-panel__list">
          {sidePanel.remaining.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      {sidePanel.nextStep && (
        <div className="atlas-side-panel__next">
          <span>Next Step</span>
          <strong>{sidePanel.nextStep}</strong>
        </div>
      )}
    </motion.aside>
  );
}
