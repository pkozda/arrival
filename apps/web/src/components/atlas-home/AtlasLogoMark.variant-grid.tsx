type Props = {
  className?: string;
};

const CYAN = '#58BDFC';
const VIOLET = '#C4B5FD';
const BG = '#050A14';

/** Backup variant — navigation grid + A+A monogram + corner star. */
export function AtlasLogoMarkGrid({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="30" height="30" rx="7" fill={BG} stroke="rgba(88, 189, 252, 0.2)" />
      <g stroke={CYAN} strokeOpacity="0.16" strokeWidth="0.85">
        <line x1="8" y1="5" x2="8" y2="27" />
        <line x1="16" y1="5" x2="16" y2="27" />
        <line x1="24" y1="5" x2="24" y2="27" />
        <line x1="4" y1="11" x2="28" y2="11" />
        <line x1="4" y1="19" x2="28" y2="19" />
        <line x1="4" y1="27" x2="28" y2="27" />
      </g>
      <g fill={CYAN} fillOpacity="0.55">
        <circle cx="8" cy="11" r="0.75" />
        <circle cx="16" cy="19" r="0.75" />
        <circle cx="24" cy="19" r="0.75" />
      </g>
      <g stroke={CYAN} strokeWidth="2.35" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.75 23.25 L10 13.25 L13.25 23.25" />
        <line x1="7.75" y1="18.75" x2="12.25" y2="18.75" />
        <path d="M18.75 23.25 L22 13.25 L25.25 23.25" />
        <line x1="19.75" y1="18.75" x2="24.25" y2="18.75" />
        <line x1="16" y1="16.25" x2="16" y2="21.25" />
        <line x1="13.75" y1="18.75" x2="18.25" y2="18.75" />
      </g>
      <g strokeLinecap="round">
        <line x1="25.5" y1="7.25" x2="25.5" y2="2.75" stroke={VIOLET} strokeWidth="1.65" />
        <line x1="25.5" y1="7.25" x2="29.25" y2="5.5" stroke={CYAN} strokeWidth="1.35" />
        <line x1="25.5" y1="7.25" x2="28.75" y2="10.25" stroke={CYAN} strokeWidth="1.15" />
        <line x1="25.5" y1="7.25" x2="22.25" y2="9.75" stroke={CYAN} strokeWidth="1.5" />
        <line x1="25.5" y1="7.25" x2="21.75" y2="7.25" stroke={CYAN} strokeWidth="1" />
        <line x1="25.5" y1="7.25" x2="23.25" y2="4.5" stroke={CYAN} strokeWidth="1.25" />
        <line x1="25.5" y1="7.25" x2="28.25" y2="3.75" stroke={CYAN} strokeWidth="0.95" />
        <line x1="25.5" y1="7.25" x2="27.5" y2="11.5" stroke={CYAN} strokeWidth="0.85" />
        <circle cx="25.5" cy="7.25" r="1.35" fill={BG} stroke={VIOLET} strokeWidth="1.25" />
      </g>
    </svg>
  );
}
