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
};

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

export function AtlasMap({ slide, locationLabel, loadPhase, parallaxOffset }: Props) {
  const zoom = slide.mapZoom ?? 1;
  const focusNode = slide.focusNode
    ? ATLAS_NODES.find((node) => node.id === slide.focusNode)
    : null;
  const offsetX = focusNode ? 400 - focusNode.x : 0;
  const offsetY = focusNode ? 300 - focusNode.y : 0;

  return (
    <div className="atlas-map" data-ui-surface="home-atlas-map">
      <svg className="atlas-map__constellation-local" viewBox="0 0 800 600" aria-hidden="true">
        {ATLAS_NODES.filter((n) => !n.isCenter).map((node) => (
          <line
            key={`local-${node.id}`}
            x1={400}
            y1={300}
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
        <motion.svg
          viewBox="0 0 800 600"
          className="atlas-map__svg"
          role="img"
          aria-label="Life domain map"
          animate={{
            scale: zoom,
            x: offsetX * 0.28,
            y: offsetY * 0.28,
          }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
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
            <filter id="atlas-node-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="atlas-beacon-glow" x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="18" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

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
              revealIndex={
                node.isCenter
                  ? DOMAIN_NODE_ORDER.length
                  : DOMAIN_NODE_ORDER.indexOf(node.id)
              }
            />
          ))}
        </motion.svg>
      </motion.div>
    </div>
  );
}
