import type { DiscoveryResult } from '../types/result.js';
import type { NoveltyStatus } from '../types/novelty.js';
import type {
  DiscoveryResultChangeMetadata,
  DiscoveryResultUserView,
} from './types.js';

export function inferNoveltyFromResult(result: DiscoveryResult): NoveltyStatus {
  if (result.firstSeenAt === result.lastChangedAt) {
    return 'NEW';
  }
  if (Date.parse(result.lastChangedAt) > Date.parse(result.firstSeenAt)) {
    return 'UPDATED';
  }
  return 'UNCHANGED';
}

export function toDiscoveryResultUserView(
  result: DiscoveryResult
): DiscoveryResultUserView {
  const changeMetadata: DiscoveryResultChangeMetadata = {
    inferredNovelty: inferNoveltyFromResult(result),
    changedFields: result.changedFields ?? [],
  };
  return {
    ...structuredClone(result),
    changeMetadata,
  };
}
