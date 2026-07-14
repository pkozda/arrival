/** Env: set `NEXT_PUBLIC_CURRENT_SITUATION_ENABLED=true` to enable CSR infrastructure consumers (E2+). */
export const CURRENT_SITUATION_ENV_KEY = 'NEXT_PUBLIC_CURRENT_SITUATION_ENABLED';

export function isCurrentSituationEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  const value = env[CURRENT_SITUATION_ENV_KEY];
  return value === '1' || value === 'true';
}
