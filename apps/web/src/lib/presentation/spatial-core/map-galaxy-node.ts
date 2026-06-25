import type { GalaxyNodeState } from './types';

export type GalaxyNodeEntityInput = {
  id: string;
  status: GalaxyNodeState;
};

export function toGalaxyNodeStatus(
  input: Pick<GalaxyNodeEntityInput, 'status'>
): GalaxyNodeState {
  return input.status;
}

export function galaxyStatusLabel(status: GalaxyNodeState): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'recommended':
      return 'Recommended now';
    case 'blocked':
      return 'Blocked';
    case 'future':
      return 'Future';
    case 'core':
      return 'Current state';
    default:
      return 'Unknown';
  }
}
