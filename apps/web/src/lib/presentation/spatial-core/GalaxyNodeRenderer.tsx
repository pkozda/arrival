'use client';

import { memo, type CSSProperties, type ReactNode } from 'react';
import type { GalaxyNodeState, GalaxyNodeVisualState } from './types';
import type { NodeStarRating } from './module-progress';

export type GalaxyNodeRendererProps = {
  id: string;
  status: GalaxyNodeState;
  x: number;
  y: number;
  title: ReactNode;
  descriptor?: ReactNode;
  visual: GalaxyNodeVisualState;
  nodeStars?: NodeStarRating;
  disabled?: boolean;
  lockHint?: string;
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
  nodeStars = 0,
  disabled = false,
  lockHint,
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
      }${visual.isHovered ? ' is-hovered' : ''}${visual.isLocked ? ' is-locked' : ''}${
        visual.isDependencySourceHighlight ? ' is-dependency-source-highlight' : ''
      }${visual.isGravitySourceActive ? ' is-gravity-source-active' : ''}${
        visual.isGravityTargetPulled ? ' is-gravity-target-pulled' : ''
      } le-consequence-node--scale-${visual.scaleTier}`}
      style={
        {
          '--node-x': `${x}%`,
          '--node-y': `${y}%`,
          '--gravity-x': `${visual.gravityOffsetX}px`,
          '--gravity-y': `${visual.gravityOffsetY}px`,
          '--gravity-pull': visual.gravityPullIntensity,
        } as CSSProperties
      }
      title={visual.isLocked ? lockHint : undefined}
      aria-disabled={visual.isLocked || undefined}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(id)}
      onBlur={() => onHover(null)}
      onClick={() => {
        if (!visual.isJourneyNode && !visual.isLocked) {
          onSelect(id);
        }
      }}
      aria-selected={visual.isSelected}
      disabled={disabled}
    >
      <span className="le-consequence-node__beacon">
        <span className="le-consequence-node__halo" aria-hidden="true" />
        <span className="le-consequence-node__orb" aria-hidden="true" />
        {visual.isLocked && (
          <span className="le-consequence-node__lock" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
              <circle cx="8" cy="8" r="7" fill="rgba(2, 6, 23, 0.55)" />
              <path
                d="M5.25 7.25V5.75a2.75 2.75 0 0 1 5.5 0v1.5M5 7.25h6a1 1 0 0 1 1 1v3.25a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8.25a1 1 0 0 1 1-1Z"
                stroke="rgba(226, 232, 240, 0.82)"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </span>
      <span className="le-consequence-node__label">
        <span className="le-consequence-node__title">{title}</span>
        {showDescriptor && <span className="le-consequence-node__descriptor">{descriptor}</span>}
        {visual.isLocked && visual.isHovered && lockHint && (
          <span className="le-consequence-node__lock-hint">{lockHint}</span>
        )}
        {!visual.isJourneyNode && (
          <span className="le-consequence-node__stars" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className={`le-consequence-node__star${index < nodeStars ? ' is-filled' : ''}${
                  index < nodeStars && visual.isSelected ? ' is-pulse' : ''
                }`}
              >
                ★
              </span>
            ))}
          </span>
        )}
      </span>
    </button>
  );
}

export const GalaxyNodeRenderer = memo(GalaxyNodeRendererComponent);
