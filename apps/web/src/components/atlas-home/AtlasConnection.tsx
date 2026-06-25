'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { ATLAS_NODES } from './atlas-data';
import type { AtlasLoadPhase } from './useAtlasLoadSequence';
import type { AtlasNodeId } from './types';

type Props = {
  from: AtlasNodeId;
  to: AtlasNodeId;
  emphasized: boolean;
  loadPhase: AtlasLoadPhase;
};

function nodePosition(id: AtlasNodeId) {
  const node = ATLAS_NODES.find((entry) => entry.id === id);
  if (!node) {
    return { x: 0, y: 0 };
  }
  return { x: node.x, y: node.y };
}

export const AtlasConnection = memo(function AtlasConnection({ from, to, emphasized, loadPhase }: Props) {
  const start = nodePosition(from);
  const end = nodePosition(to);
  const visible = loadPhase >= 3;

  return (
    <motion.line
      className={`atlas-connection${emphasized ? ' atlas-connection--emphasized' : ''}`}
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      initial={{ opacity: 0 }}
      animate={{
        opacity: visible ? (emphasized ? 0.95 : 0.32) : 0,
        strokeWidth: emphasized ? 2.8 : 1.4,
      }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    />
  );
});
