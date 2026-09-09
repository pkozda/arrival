/**
 * Official Anmeldung guidance URL.
 * Do not invent a URL — set only when an authoritative product source exists.
 * Opening this URL must never write municipalRegistrationConfirmed.
 */
export const ANMELDUNG_OFFICIAL_GUIDANCE_URL: string | null = null;

export const ANMELDUNG_OFFICIAL_GUIDANCE_SOURCE_STATUS = 'missing_authoritative_url' as const;

export function hasAnmeldungOfficialGuidanceUrl(): boolean {
  return typeof ANMELDUNG_OFFICIAL_GUIDANCE_URL === 'string' && ANMELDUNG_OFFICIAL_GUIDANCE_URL.length > 0;
}

export const REGISTRATION_NODE_IDS = new Set([
  'g1-complete-anmeldung',
  'g2-confirm-registration',
  'g4-register-address',
]);

export function isRegistrationPlanNodeId(nodeId: string | null | undefined): boolean {
  return Boolean(nodeId && REGISTRATION_NODE_IDS.has(nodeId));
}
