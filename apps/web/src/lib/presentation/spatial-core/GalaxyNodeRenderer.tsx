'use client';

import { memo, type CSSProperties, type ReactNode } from 'react';
import type { GalaxyNodeState, GalaxyNodeVisualState } from './types';

export type GalaxyNodeRendererProps = {
  id: string;
  status: GalaxyNodeState;
  x: number;
  y: number;
  title: ReactNode;
  descriptor?: ReactNode;
  visual: GalaxyNodeVisualState;
  disabled?: boolean;
  onHover: (nodeId: string | null) => void;
  onSelect: (nodeId: string) => void;
};

function GalaxyNodeRendererComponent({
  id,
  status,
  x,
  y,
  title,
  descriptor,
  visual,
  disabled = false,
  onHover,
  onSelect,
}: GalaxyNodeRendererProps) {
  const showDescriptor = Boolean(descriptor) && (visual.isSelected || visual.isHovered || visual.isJourneyNode);

  return (
    <button
      type="button"
      className={`le-consequence-node le-consequence-node--galaxy le-consequence-node--${status}${
        visual.isSelected ? ' is-selected' : ''
      }${visual.isNeighbor ? ' is-neighbor' : ''}${visual.isDimmed ? ' is-dimmed' : ''}${
        visual.isConstrainedDownstream ? ' is-constrained' : ''
      }${visual.isOneHopActive ? ' is-orbit-active' : ''}${visual.isTwoHopDim ? ' is-twohop-dim' : ''}${
        visual.isPrimaryRecommended ? ' is-primary-recommended' : ''
      }${visual.isHovered ? ' is-hovered' : ''}`}
      style={
        {
          '--node-x': `${x}%`,
          '--node-y': `${y}%`,
        } as CSSProperties
      }
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(id)}
      onBlur={() => onHover(null)}
      onClick={() => {
        if (!visual.isJourneyNode) {
          onSelect(id);
        }
      }}
      aria-selected={visual.isSelected}
      disabled={disabled}
    >
      <span className="le-consequence-node__beacon">
        <span className="le-consequence-node__halo" aria-hidden="true" />
        <span className="le-consequence-node__orb" aria-hidden="true" />
      </span>
      <span className="le-consequence-node__label">
        <span className="le-consequence-node__title">{title}</span>
        {showDescriptor && <span className="le-consequence-node__descriptor">{descriptor}</span>}
      </span>
    </button>
  );
}

export const GalaxyNodeRenderer = memo(GalaxyNodeRendererComponent);
