import type { ReactElement, ReactNode } from 'react';
import type { AtlasNodeId } from './types';

type IconProps = {
  size: number;
};

function Glyph({ size, children }: IconProps & { children: ReactNode }) {
  const scale = size / 24;
  return (
    <g className="atlas-node__icon-glyph" transform={`scale(${scale})`}>
      {children}
    </g>
  );
}

/** Embedded celestial glyphs — stroke-only, centered at origin. */
function UserGlyph({ size }: IconProps) {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="8.5" r="3.25" />
      <path d="M5.5 19.5c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
    </Glyph>
  );
}

function FormGlyph({ size }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M8 5.5h8a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5H8a1.5 1.5 0 0 1-1.5-1.5V7a1.5 1.5 0 0 1 1.5-1.5z" />
      <path d="M9.5 10h7" />
      <path d="M9.5 13h7" />
      <path d="M9.5 16h4.5" />
      <path d="M14.5 5.5V8a1 1 0 0 0 1 1h2.5" />
    </Glyph>
  );
}

function HouseGlyph({ size }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M12 5.5 5.5 11v8.5h5V15a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5v4.5h5V11z" />
    </Glyph>
  );
}

function MedicalGlyph({ size }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M12 6.5v11" />
      <path d="M6.5 12h11" />
    </Glyph>
  );
}

function ChartGlyph({ size }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M5 19.5V5" />
      <path d="M5 19.5h14" />
      <path d="M9 15.5V11" />
      <path d="M12.5 15.5V8.5" />
      <path d="M16 15.5V6.5" />
    </Glyph>
  );
}

function GridGlyph({ size }: IconProps) {
  return (
    <Glyph size={size}>
      <rect x="5.5" y="5.5" width="5.5" height="5.5" rx="1" />
      <rect x="13" y="5.5" width="5.5" height="5.5" rx="1" />
      <rect x="5.5" y="13" width="5.5" height="5.5" rx="1" />
      <rect x="13" y="13" width="5.5" height="5.5" rx="1" />
    </Glyph>
  );
}

function ChatGlyph({ size }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M6.5 6.5h11a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H11l-3.5 3v-3H6.5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2z" />
      <path d="M9 11.5h6" />
      <path d="M9 14.5h4" />
    </Glyph>
  );
}

const NODE_ICON: Record<AtlasNodeId, (props: IconProps) => ReactElement> = {
  center: UserGlyph,
  registration: FormGlyph,
  housing: HouseGlyph,
  healthcare: MedicalGlyph,
  finance: ChartGlyph,
  work: GridGlyph,
  community: ChatGlyph,
};

export function AtlasNodeIcon({ nodeId, coreRadius }: { nodeId: AtlasNodeId; coreRadius: number }) {
  const Icon = NODE_ICON[nodeId];
  const size = coreRadius * 2 * 0.64;
  const offset = -12 * (size / 24);

  return (
    <g className="atlas-node__icon" transform={`translate(${offset} ${offset})`}>
      <Icon size={size} />
    </g>
  );
}
