function emptyUserContext() {
  return { profile: null };
}

function makeSnapshot(overrides: Partial<import('@/lib/product-contract').UiSnapshot> = {}) {
  return {
    schemaVersion: 1,
    snapshotVersion: 1,
    lastMutationId: null,
    generatedAt: new Date().toISOString(),
    session: {
      sessionId: 'sess-1',
      language: 'en',
      uiPreferences: { theme: 'light' as const },
    },
    userContext: emptyUserContext(),
    executionsByModuleId: {},
    executions: [],
    summaries: [],
    actionCards: [],
    recommendations: [],
    ftu: { isFirstTimeUser: true },
    ...overrides,
  };
}

export { emptyUserContext, makeSnapshot };
