/** Env: set `NEXT_PUBLIC_GUIDE_USE_CERTAINTY=true` to consume CertaintyState in Journey Guide. */
export const GUIDE_USE_CERTAINTY_ENV_KEY = 'NEXT_PUBLIC_GUIDE_USE_CERTAINTY';

export function isGuideUseCertaintyEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  const value = env[GUIDE_USE_CERTAINTY_ENV_KEY];
  return value === '1' || value === 'true';
}
