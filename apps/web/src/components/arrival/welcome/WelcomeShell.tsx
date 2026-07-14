import type { ReactNode } from 'react';

type Props = {
  reducedMotion: boolean;
  children: ReactNode;
};

export function WelcomeShell({ reducedMotion, children }: Props) {
  return (
    <section
      className={`arrival-welcome${reducedMotion ? ' arrival-welcome--reduced-motion' : ''}`}
      data-ui-surface="arrival-welcome"
      aria-labelledby="arrival-welcome-title"
    >
      <div
        className={`arrival-welcome__scrim${reducedMotion ? ' arrival-welcome__scrim--static' : ''}`}
        aria-hidden="true"
      />
      <div
        className={`arrival-welcome__card${reducedMotion ? ' arrival-welcome__card--static' : ''}`}
      >
        {children}
      </div>
    </section>
  );
}
