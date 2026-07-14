/** Env: set `NEXT_PUBLIC_CERTAINTY_LAYER_ENABLED=true` to enable E1 proving-ground UI. */
export const CERTAINTY_LAYER_ENV_KEY = 'NEXT_PUBLIC_CERTAINTY_LAYER_ENABLED';

export function isCertaintyLayerEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  const value = env[CERTAINTY_LAYER_ENV_KEY];
  return value === '1' || value === 'true';
}
