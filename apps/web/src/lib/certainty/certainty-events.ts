import type { CertaintyState } from './types';

export const CERTAINTY_TELEMETRY_EVENT = 'arrival-atlas:certainty-telemetry';

export type CertaintyTelemetryName =
  | 'certainty_panel_viewed'
  | 'certainty_next_step_seen';

export type CertaintyTelemetryDetail = {
  name: CertaintyTelemetryName;
  at: string;
  surface?: string;
  location?: string;
  confidence?: CertaintyState['confidence'];
};

export function emitCertaintyTelemetry(
  detail: Omit<CertaintyTelemetryDetail, 'at'> & { at?: string }
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: CertaintyTelemetryDetail = {
    ...detail,
    at: detail.at ?? new Date().toISOString(),
  };

  window.dispatchEvent(
    new CustomEvent<CertaintyTelemetryDetail>(CERTAINTY_TELEMETRY_EVENT, { detail: payload })
  );
}
