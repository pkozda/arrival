import type { EconomicActionV1 } from '@arrival-atlas/product-contract';

export function pruneActionSetActions(
  actions: EconomicActionV1[],
  allowedIds: Set<string>
): EconomicActionV1[] {
  return actions.filter((action) => allowedIds.has(action.id));
}

export function assertNoCrossTrackDuplicates(tracks: {
  primary: EconomicActionV1[];
  secondary: EconomicActionV1[];
  system: EconomicActionV1[];
}): void {
  const seen = new Set<string>();

  for (const track of [tracks.primary, tracks.secondary, tracks.system]) {
    for (const action of track) {
      if (seen.has(action.id)) {
        throw new Error(`Duplicate action across tracks: ${action.id}`);
      }
      seen.add(action.id);
    }
  }
}
