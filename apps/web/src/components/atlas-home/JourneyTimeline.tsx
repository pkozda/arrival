'use client';

import { motion } from 'framer-motion';
import { JOURNEY_STAGES } from './atlas-data';
import type { AtlasLoadPhase } from './useAtlasLoadSequence';
import type { JourneyStageId } from './types';

type Props = {
  activeStage: JourneyStageId;
  loadPhase: AtlasLoadPhase;
};

export function JourneyTimeline({ activeStage, loadPhase }: Props) {
  const activeIndex = JOURNEY_STAGES.findIndex((stage) => stage.id === activeStage);
  const progressPercent =
    activeIndex <= 0 ? 0 : (activeIndex / (JOURNEY_STAGES.length - 1)) * 100;
  const uiVisible = loadPhase >= 5;

  return (
    <footer
      className="atlas-journey"
      aria-label="Journey timeline"
      style={{ opacity: uiVisible ? 1 : 0, transition: 'opacity 0.6s ease' }}
    >
      <div className="atlas-journey__route" aria-hidden="true">
        <div className="atlas-journey__route-track" />
        <motion.div
          className="atlas-journey__route-glow"
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <div className="atlas-journey__track">
        {JOURNEY_STAGES.map((stage, index) => {
          const isActive = stage.id === activeStage;
          const isPast = activeIndex > index;
          const isFuture = activeIndex < index;

          return (
            <div
              key={stage.id}
              className={`atlas-journey__stage${isActive ? ' is-active' : ''}${isPast ? ' is-past' : ''}${isFuture ? ' is-future' : ''}`}
            >
              <motion.span
                className="atlas-journey__dot"
                animate={
                  isActive
                    ? { scale: [1, 1.35, 1], opacity: [0.75, 1, 0.75] }
                    : { scale: 1, opacity: isPast ? 0.85 : isFuture ? 0.3 : 0.5 }
                }
                transition={{ duration: 2.8, repeat: isActive ? Infinity : 0, ease: 'easeInOut' }}
              />
              <span className="atlas-journey__label">{stage.label}</span>
              <span className="atlas-journey__subtitle">{stage.subtitle}</span>
            </div>
          );
        })}
      </div>
    </footer>
  );
}
