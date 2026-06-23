'use client';

import { useEffect, useState } from 'react';
import { CELESTIAL_NODE_LABELS } from '@/lib/celestial';
import { useArrival } from './ArrivalProvider';

export function NodeTrace() {
  const { arrival, spatialPhase } = useArrival();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (spatialPhase === 'entering' || spatialPhase === 'landed') {
      setVisible(true);
      const timer = window.setTimeout(() => setVisible(false), 3200);
      return () => window.clearTimeout(timer);
    }

    setVisible(false);
    return undefined;
  }, [spatialPhase, arrival?.sourceNodeId]);

  if (!arrival || !visible) {
    return null;
  }

  const label = CELESTIAL_NODE_LABELS[arrival.sourceNodeId];

  return (
    <div className="celestial-node-trace" aria-hidden="true">
      <span className="celestial-node-trace__pulse" />
      <span className="celestial-node-trace__copy">
        Arriving from <strong>{label}</strong>
      </span>
    </div>
  );
}
