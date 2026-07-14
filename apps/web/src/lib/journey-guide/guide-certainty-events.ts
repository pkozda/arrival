export const GUIDE_CERTAINTY_TELEMETRY_EVENT = 'arrival-atlas:guide-certainty-telemetry';

export type GuideCertaintyTelemetryName =
  | 'guide_certainty_enabled'
  | 'guide_certainty_fallback'
  | 'guide_certainty_missing';

export type GuideCertaintyTelemetryDetail = {
  name: GuideCertaintyTelemetryName;
  at: string;
  surface?: string;
};

export function emitGuideCertaintyTelemetry(
  detail: Omit<GuideCertaintyTelemetryDetail, 'at'> & { at?: string }
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: GuideCertaintyTelemetryDetail = {
    ...detail,
    at: detail.at ?? new Date().toISOString(),
  };

  window.dispatchEvent(
    new CustomEvent<GuideCertaintyTelemetryDetail>(GUIDE_CERTAINTY_TELEMETRY_EVENT, { detail: payload })
  );
}
