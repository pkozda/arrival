import type { CertaintyState } from '@/lib/certainty/types';
import type { CertaintySurfaceBundle } from '@/lib/certainty/types-bundle';

/** Known certainty-producing surfaces. */
export type CurrentSituationSource = 'life-events' | 'profile' | 'economic';

/** Numeric tie-break when confidence levels are equal (higher wins). */
export type SurfacePriority = number;

/** Semantic reason the resolver selected a winner — not user-facing copy. */
export type ResolutionReason =
  | 'empty_registry'
  | 'only_registered_surface'
  | 'highest_priority_blocked'
  | 'highest_confidence_needs_attention'
  | 'highest_confidence_clear'
  | 'highest_surface_priority_tiebreak'
  | 'fallback_unknown';

/** Platform-wide current situation — winning certainty snapshot. */
export type CurrentSituation = {
  source: CurrentSituationSource;
  certainty: CertaintyState;
  priority: SurfacePriority;
};

/** Full resolver output including selection rationale. */
export type CurrentSituationResult = CurrentSituation & {
  reason: ResolutionReason;
};

export type SurfaceRegistration = {
  surface: CurrentSituationSource;
  bundle: CertaintySurfaceBundle;
  priority: SurfacePriority;
  registeredAt: number;
};

export type RegisterSurfaceInput = {
  surface: CurrentSituationSource;
  bundle: CertaintySurfaceBundle;
  priority?: SurfacePriority;
};

export type CurrentSituationListener = (result: CurrentSituationResult | null) => void;

export type ValidationErrorCode =
  | 'invalid_source'
  | 'invalid_priority'
  | 'missing_certainty'
  | 'invalid_certainty';

export type ValidationResult =
  | { ok: true; registration: SurfaceRegistration }
  | { ok: false; error: ValidationErrorCode };
