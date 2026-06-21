import type {
  EconomicActionSetV1,
  EconomicActionV1,
  GraphExecutionStateV1,
  OrderingStrategy,
} from '@arrival-atlas/product-contract';
import type { ClassifiedTracks, TrackKind } from './types.js';

function nodeStatus(
  execution: GraphExecutionStateV1,
  action: EconomicActionV1
): 'active' | 'completed' | 'locked' | 'skipped' {
  return execution.nodes[action.sourceNodeId]?.status ?? 'locked';
}

export function classifyActionTrack(
  action: EconomicActionV1,
  execution: GraphExecutionStateV1,
  strategy: OrderingStrategy
): TrackKind {
  const status = nodeStatus(execution, action);
  const systemIntent = action.payload.systemIntent;

  if (strategy === 'CRISIS_FIRST') {
    if (systemIntent === 'initiate_benefit_application') {
      return 'primary';
    }
    if (action.type === 'external_resource' || action.type === 'system_intent') {
      return 'system';
    }
    if (status === 'active') {
      return 'primary';
    }
    return 'secondary';
  }

  if (strategy === 'INSTITUTION_FIRST') {
    if (action.type === 'system_intent') {
      return 'primary';
    }
    if (action.type === 'external_resource') {
      return 'system';
    }
    if (action.type === 'open_module' || (action.type === 'update_profile' && status === 'active')) {
      return 'primary';
    }
    return 'secondary';
  }

  if (action.type === 'external_resource') {
    return 'system';
  }
  if (action.type === 'system_intent') {
    return status === 'active' ? 'primary' : 'system';
  }
  if (status === 'completed') {
    return 'secondary';
  }
  return 'primary';
}

export function classifyActionsIntoTracks(
  actionSet: EconomicActionSetV1,
  execution: GraphExecutionStateV1,
  strategy: OrderingStrategy
): ClassifiedTracks {
  const tracks: ClassifiedTracks = {
    primary: [],
    secondary: [],
    system: [],
  };

  for (const action of actionSet.actions) {
    const track = classifyActionTrack(action, execution, strategy);
    tracks[track].push(action);
  }

  return tracks;
}

export function deduplicateAcrossTracks(tracks: ClassifiedTracks): ClassifiedTracks {
  const seen = new Set<string>();
  const deduped: ClassifiedTracks = { primary: [], secondary: [], system: [] };

  for (const track of ['primary', 'secondary', 'system'] as const) {
    for (const action of tracks[track]) {
      if (seen.has(action.id)) {
        continue;
      }
      seen.add(action.id);
      deduped[track].push(action);
    }
  }

  return deduped;
}
