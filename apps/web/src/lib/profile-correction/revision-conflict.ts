export function parseRevisionConflictCurrentHead(message: string): number | null {
  const match = message.match(/current is (\d+)/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function isRevisionConflictError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('REVISION_CONFLICT') ||
    error.message.includes('Expected head revision') ||
    error.message.includes('current is')
  );
}
