import type { MutationRequest, SupportedLanguage, ThemePreference } from '@/lib/product-contract';

export function generateMutationRequestId(prefix = 'web'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function baseMutation(
  requestId: string,
  partial: Omit<MutationRequest, 'id' | 'requestId' | 'timestamp' | 'confidence' | 'userConfirmationRequired'>
): MutationRequest {
  return {
    id: requestId,
    requestId,
    timestamp: new Date().toISOString(),
    confidence: 1,
    userConfirmationRequired: false,
    ...partial,
  };
}

export function buildHeaderLanguageMutation(language: SupportedLanguage): MutationRequest {
  const requestId = generateMutationRequestId('pref-lang');
  return baseMutation(requestId, {
    type: 'pref.update',
    intent: 'preference',
    domain: 'preferences',
    source: { kind: 'header', prefField: 'language' },
    payload: {
      kind: 'pref',
      field: 'preferredLanguage',
      value: language,
    },
  });
}

export function buildHeaderThemeMutation(theme: ThemePreference): MutationRequest {
  const requestId = generateMutationRequestId('pref-theme');
  return baseMutation(requestId, {
    type: 'pref.update',
    intent: 'preference',
    domain: 'preferences',
    source: { kind: 'header', prefField: 'theme' },
    payload: {
      kind: 'pref',
      field: 'theme',
      value: theme,
    },
  });
}
