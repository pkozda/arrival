'use client';

import type { ReactNode } from 'react';
import type { JourneyGuideProbeState } from './types';

type ProbeProps = {
  state?: JourneyGuideProbeState;
  className?: string;
};

export function JourneyGuideProbe({ state = 'idle', className = '' }: ProbeProps) {
  return (
    <span
      className={`journey-guide-probe journey-guide-probe--${state}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      <span className="journey-guide-probe__core" />
      <span className="journey-guide-probe__ring" />
      <span className="journey-guide-probe__glow" />
    </span>
  );
}

type SpeechProps = {
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
};

export function JourneyGuideSpeech({ title, children, onClose }: SpeechProps) {
  return (
    <div className="journey-guide-speech" role="status" aria-live="polite">
      {title && <p className="journey-guide-speech__title">{title}</p>}
      <div className="journey-guide-speech__body">{children}</div>
      {onClose && (
        <button type="button" className="journey-guide-speech__close" onClick={onClose} aria-label="Dismiss guide">
          ×
        </button>
      )}
    </div>
  );
}

type WelcomeProps = {
  onStartGuided: () => void;
  onExploreAlone: () => void;
};

export function JourneyGuideWelcome({ onStartGuided, onExploreAlone }: WelcomeProps) {
  return (
    <div className="journey-guide-welcome" role="dialog" aria-labelledby="journey-guide-welcome-title">
      <JourneyGuideProbe state="speaking" />
      <div className="journey-guide-welcome__panel">
        <h2 id="journey-guide-welcome-title" className="journey-guide-welcome__title">
          Welcome to Arrival Atlas.
        </h2>
        <p className="journey-guide-welcome__lead">Let&apos;s build your journey together.</p>
        <div className="journey-guide-welcome__actions">
          <button type="button" className="journey-guide-btn journey-guide-btn--primary" onClick={onStartGuided}>
            Start Guided Journey
          </button>
          <button type="button" className="journey-guide-btn journey-guide-btn--ghost" onClick={onExploreAlone}>
            Explore On My Own
          </button>
        </div>
      </div>
    </div>
  );
}

type FloatingButtonProps = {
  onClick: () => void;
  label?: string;
};

export function JourneyGuideFloatingButton({ onClick, label = 'Journey Guide' }: FloatingButtonProps) {
  return (
    <button
      type="button"
      className="journey-guide-fab"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <JourneyGuideProbe state="idle" />
    </button>
  );
}
