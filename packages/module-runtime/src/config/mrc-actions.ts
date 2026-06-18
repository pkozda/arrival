import { isMrcExplanationEnabled } from './mrc-explanation.js';

/** Actions are produced when explanation mode is on (ADL §2.5). */
export function isMrcActionsEnabled(): boolean {
  return isMrcExplanationEnabled();
}
