import type { CertaintyState } from './types';

/** Shared bundle shape for surface adapters (Guide-ready). */
export type CertaintyBundleMeta = Record<string, unknown>;

export type CertaintySurfaceBundle = {
  state: CertaintyState;
  recommendedFocusId: string | null;
  meta?: CertaintyBundleMeta;
};
