'use client';

import { motion } from 'framer-motion';
import { AtlasNodeIcon } from './atlas-node-icons';
import type { AtlasLoadPhase } from './useAtlasLoadSequence';
import type { AtlasNodeId, AtlasNodeState } from './types';

type Props = {
  id: AtlasNodeId;
  label: string;
  x: number;
  y: number;
  state: AtlasNodeState;
  isCenter?: boolean;
  sublabel?: string;
  isFocused: boolean;
  loadPhase: AtlasLoadPhase;
  revealIndex: number;
  interactive: boolean;
  onSelect?: () => void;
};

const STATE_CLASS: Record<AtlasNodeState, string> = {
  inactive: 'atlas-node--inactive',
  active: 'atlas-node--active',
  completed: 'atlas-node--completed',
  blocked: 'atlas-node--blocked',
};

export function AtlasNode({
  id,
  label,
  x,
  y,
  state,
  isCenter = false,
  sublabel,
  isFocused,
  loadPhase,
  revealIndex,
  interactive,
  onSelect,
}: Props) {
  const isRevealed = isCenter ? loadPhase >= 4 : loadPhase >= 3;
  const isLit = isCenter ? loadPhase >= 4 : loadPhase >= 3;
  const staggerDelay = isCenter ? 0 : revealIndex * 0.1;

  const hoverScale = isCenter ? 1.08 : 1.15;
  const focusScale = isCenter ? 1.12 : 1.25;
  const baseScale = isFocused ? focusScale : 1;
  const canInteract = interactive && isRevealed;
  const isSelectable = canInteract && Boolean(onSelect);
  const coreRadius = isCenter ? 24 : isFocused ? 16 : 13;
  const glowRadius = isCenter ? 52 : isFocused ? 44 : 36;
  const pulseRadius = isCenter ? 38 : isFocused ? 28 : 22;

  const handleSelect = () => {
    onSelect?.();
  };

  return (
    <g transform={`translate(${x} ${y})`}>
      <motion.g
        className={`atlas-node ${STATE_CLASS[state]}${isCenter ? ' atlas-node--center' : ''}${isFocused ? ' atlas-node--focused' : ''}${isLit ? ' atlas-node--lit' : ''}${isSelectable ? ' atlas-node--selectable' : ''}`}
        data-node-id={id}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{
          opacity: isRevealed ? 1 : 0,
          scale: isRevealed ? baseScale : 0.4,
        }}
        whileHover={canInteract ? { scale: hoverScale } : undefined}
        transition={{
          opacity: { duration: 0.5, delay: staggerDelay, ease: [0.16, 1, 0.3, 1] },
          scale: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
        }}
        style={{ transformOrigin: '0px 0px' }}
      >
        {isCenter ? (
          <>
            <circle className="atlas-node__beacon-pulse" r={95} />
            <circle className="atlas-node__halo" r={88} />
            <circle className="atlas-node__ring atlas-node__ring--outer" r={68} />
            <circle className="atlas-node__ring atlas-node__ring--inner" r={46} />
            <circle className="atlas-node__radiance atlas-node__radiance--center" r={62} />
            <circle className="atlas-node__glow atlas-node__glow--center" r={glowRadius} />
            <circle className="atlas-node__pulse" r={pulseRadius} />
            <circle className="atlas-node__core atlas-node__core--center" r={coreRadius} />
            <AtlasNodeIcon nodeId={id} coreRadius={coreRadius} />
            <text className="atlas-node__label atlas-node__label--center" y={-78} textAnchor="middle">
              {label}
            </text>
            {sublabel && (
              <text className="atlas-node__sublabel atlas-node__sublabel--center" y={88} textAnchor="middle">
                {sublabel}
              </text>
            )}
          </>
        ) : (
          <>
            <circle className="atlas-node__radiance" r={glowRadius + 6} />
            <circle className="atlas-node__glow" r={glowRadius} />
            <circle className="atlas-node__pulse" r={pulseRadius} />
            <circle className="atlas-node__core" r={coreRadius} />
            <AtlasNodeIcon nodeId={id} coreRadius={coreRadius} />
            <text className="atlas-node__label" y={isFocused ? -38 : -34} textAnchor="middle">
              {label}
            </text>
          </>
        )}
        {isSelectable && (
          <circle
            className="atlas-node__hit"
            r={isCenter ? 80 : 40}
            fill="transparent"
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation();
              handleSelect();
            }}
          />
        )}
      </motion.g>
    </g>
  );
}
