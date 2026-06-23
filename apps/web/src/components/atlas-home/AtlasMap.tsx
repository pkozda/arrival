'use client';

import { motion } from 'framer-motion';
import { ATLAS_CONNECTIONS, ATLAS_NODES } from './atlas-data';
import { AtlasConnection } from './AtlasConnection';
import { AtlasNode } from './AtlasNode';
import type { AtlasLoadPhase } from './useAtlasLoadSequence';
import type { ParallaxOffset } from './useAtlasParallax';
import type { AtlasNodeId, AtlasNodeState, AtlasSlideDefinition } from './types';

type Props = {
  slide: AtlasSlideDefinition;
  locationLabel: string;
  loadPhase: AtlasLoadPhase;
  parallaxOffset: ParallaxOffset;
  interactive: boolean;
  onNodeSelect?: (nodeId: AtlasNodeId) => void;
};

const MAP_CENTER_X = 400;
const MAP_CENTER_Y = 300;

function connectionKey(from: AtlasNodeId, to: AtlasNodeId): string {
  return `${from}-${to}`;
}

function isEmphasized(
  slide: AtlasSlideDefinition,
  from: AtlasNodeId,
  to: AtlasNodeId
): boolean {
  return slide.emphasizedConnections.some(
    ([a, b]) => (a === from && b === to) || (a === to && b === from)
  );
}

function resolveNodeState(
  slide: AtlasSlideDefinition,
  nodeId: AtlasNodeId
): AtlasNodeState {
  if (nodeId === 'center') {
    return 'active';
  }
  if (slide.blockedNodes.includes(nodeId)) {
    return 'blocked';
  }
  if (slide.completedNodes.includes(nodeId)) {
    return 'completed';
  }
  if (slide.focusNode === nodeId) {
    return 'active';
  }
  return 'inactive';
}

const DOMAIN_NODE_ORDER: AtlasNodeId[] = [
  'registration',
  'housing',
  'healthcare',
  'finance',
  'work',
  'community',
];

export function AtlasMap({
  slide,
  locationLabel,
  loadPhase,
  parallaxOffset,
  interactive,
  onNodeSelect,
}: Props) {
  const zoom = interactive ? (slide.mapZoom ?? 1) : 1;
  const focusNode =
    interactive && slide.focusNode
      ? ATLAS_NODES.find((node) => node.id === slide.focusNode)
      : null;
  const panX = focusNode ? (MAP_CENTER_X - focusNode.x) * 0.28 : 0;
  const panY = focusNode ? (MAP_CENTER_Y - focusNode.y) * 0.28 : 0;

  return (
    <div
      className={`atlas-map${interactive ? '' : ' atlas-map--static'}`}
      data-ui-surface="home-atlas-map"
    >
      <svg
        className="atlas-map__constellation-local"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {ATLAS_NODES.filter((n) => !n.isCenter).map((node) => (
          <line
            key={`local-${node.id}`}
            x1={MAP_CENTER_X}
            y1={MAP_CENTER_Y}
            x2={node.x}
            y2={node.y}
            className="atlas-map__local-line"
            style={{ opacity: loadPhase >= 2 ? 0.12 : 0 }}
          />
        ))}
      </svg>

      <motion.div
        className="atlas-map__viewport"
        style={{
          transform: `translate(${parallaxOffset.x}px, ${parallaxOffset.y}px)`,
        }}
      >
        <svg
          viewBox="0 0 800 600"
          className="atlas-map__svg"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Life domain map"
        >
          <defs>
            <radialGradient id="atlas-map-vignette" cx="50%" cy="48%" r="55%">
              <stop offset="0%" stopColor="rgba(56, 189, 248, 0.14)" />
              <stop offset="55%" stopColor="rgba(129, 140, 248, 0.06)" />
              <stop offset="100%" stopColor="rgba(5, 8, 22, 0)" />
            </radialGradient>
            <linearGradient id="atlas-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(56, 189, 248, 0.15)" />
              <stop offset="50%" stopColor="rgba(129, 140, 248, 0.9)" />
              <stop offset="100%" stopColor="rgba(45, 212, 191, 0.25)" />
            </linearGradient>
            <filter id="atlas-beacon-glow" x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="18" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <motion.g
            animate={{
              scale: zoom,
              x: panX,
              y: panY,
            }}
            transition={{
              duration: interactive ? 0.85 : 0,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{ transformOrigin: `${MAP_CENTER_X}px ${MAP_CENTER_Y}px` }}
          >
            <rect width="800" height="600" fill="url(#atlas-map-vignette)" />

            {ATLAS_CONNECTIONS.map((connection) => (
              <AtlasConnection
                key={connectionKey(connection.from, connection.to)}
                from={connection.from}
                to={connection.to}
                emphasized={isEmphasized(slide, connection.from, connection.to)}
                loadPhase={loadPhase}
              />
            ))}

            {ATLAS_NODES.map((node) => (
              <AtlasNode
                key={node.id}
                id={node.id}
                label={node.label}
                x={node.x}
                y={node.y}
                isCenter={node.isCenter}
                sublabel={node.isCenter ? locationLabel : undefined}
                state={resolveNodeState(slide, node.id)}
                isFocused={slide.focusNode === node.id}
                loadPhase={loadPhase}
                interactive={interactive}
                revealIndex={
                  node.isCenter
                    ? DOMAIN_NODE_ORDER.length
                    : DOMAIN_NODE_ORDER.indexOf(node.id)
                }
                onSelect={
                  interactive && onNodeSelect
                    ? () => onNodeSelect(node.id)
                    : undefined
                }
              />
            ))}
          </motion.g>
        </svg>
      </motion.div>
    </div>
  );
}
