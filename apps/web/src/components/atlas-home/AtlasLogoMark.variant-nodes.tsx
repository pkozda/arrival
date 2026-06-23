type Props = {
  className?: string;
};

/** Backup variant — bold A with network nodes (readable at 16px). */
export function AtlasLogoMarkNodes({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="30" height="30" rx="7" fill="#050A14" stroke="rgba(88, 189, 252, 0.2)" />
      <path
        d="M7.5 27.25 L16 4.5 L24.5 27.25"
        stroke="#58BDFC"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="11" y1="18.25" x2="21" y2="18.25" stroke="#58BDFC" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="8" r="2.85" fill="#050A14" stroke="#C4B5FD" strokeWidth="2" />
      <circle cx="10.25" cy="23.75" r="2.85" fill="#050A14" stroke="#58BDFC" strokeWidth="2" />
      <circle cx="21.75" cy="23.75" r="2.85" fill="#050A14" stroke="#58BDFC" strokeWidth="2" />
      <circle cx="16" cy="18.25" r="1.65" fill="#58BDFC" />
    </svg>
  );
}
