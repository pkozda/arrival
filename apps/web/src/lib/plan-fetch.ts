export function isMissingUserContextProfilePlanResponse(
  status: number,
  body: { error?: string; code?: string } | null
): boolean {
  if (status !== 400) {
    return false;
  }

  const message = body?.error?.toLowerCase() ?? '';
  return message.includes('usercontext profile required');
}
