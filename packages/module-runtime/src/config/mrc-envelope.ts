import { isMrcExplanationEnabled } from './mrc-explanation.js';

/** ADL FLAG-01: EXPLANATION implicitly enables envelope. */
export function isMrcEnvelopeEnabled(): boolean {
  return (
    process.env.ARRIVALOS_MRC_ENVELOPE === 'true' || isMrcExplanationEnabled()
  );
}
