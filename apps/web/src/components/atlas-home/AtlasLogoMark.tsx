type Props = {
  className?: string;
};

const CYAN = '#58BDFC';
const VIOLET = '#C4B5FD';
const BG = '#050A14';

/** Compass bearings + constellation links — no letterform (variant C). */
export function AtlasLogoMark({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="30" height="30" rx="7" fill={BG} />

      {/* Constellation links — drawn under bearings */}
      <g stroke={CYAN} strokeOpacity="0.38" strokeWidth="1" strokeLinecap="round">
        <line x1="8" y1="10.5" x2="16" y2="6.75" />
        <line x1="25.25" y1="12.25" x2="21.75" y2="23.5" />
        <line x1="8" y1="10.5" x2="7.75" y2="21.25" />
      </g>

      {/* Compass bearings — asymmetric lengths */}
      <g strokeLinecap="round">
        <line x1="16" y1="17.25" x2="16" y2="6.75" stroke={VIOLET} strokeWidth="2" />
        <line x1="16" y1="17.25" x2="25.25" y2="12.25" stroke={CYAN} strokeWidth="1.55" />
        <line x1="16" y1="17.25" x2="7.75" y2="21.25" stroke={CYAN} strokeWidth="1.55" />
        <line x1="16" y1="17.25" x2="21.75" y2="23.5" stroke={CYAN} strokeWidth="1.2" strokeOpacity="0.82" />
      </g>

      {/* Constellation nodes */}
      <g>
        <circle cx="16" cy="6.75" r="1.35" fill={VIOLET} />
        <circle cx="25.25" cy="12.25" r="1.15" fill={CYAN} />
        <circle cx="7.75" cy="21.25" r="1.15" fill={CYAN} />
        <circle cx="21.75" cy="23.5" r="0.95" fill={CYAN} fillOpacity="0.75" />
        <circle cx="8" cy="10.5" r="0.9" fill={CYAN} fillOpacity="0.55" />
      </g>

      {/* Hub — you-are-here */}
      <circle cx="16" cy="17.25" r="2.1" fill={BG} stroke={VIOLET} strokeWidth="1.65" />
      <circle cx="16" cy="17.25" r="0.85" fill={CYAN} />
    </svg>
  );
}
