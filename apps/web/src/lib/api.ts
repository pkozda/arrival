const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface ModuleInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
}

export interface ModuleResult<T = unknown> {
  moduleId: string;
  version: string;
  success: boolean;
  data?: T;
  error?: string;
  executedAt: string;
}

export async function fetchModules(): Promise<ModuleInfo[]> {
  const res = await fetch(`${API_URL}/api/modules`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error('Failed to fetch modules');
  const data = await res.json();
  return data.modules;
}

export async function executeModule<TInput, TOutput>(
  moduleId: string,
  input: TInput,
  context?: Record<string, unknown>,
  sessionId?: string
): Promise<ModuleResult<TOutput>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionId) headers['x-session-id'] = sessionId;

  const res = await fetch(`${API_URL}/api/modules/${moduleId}/execute`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input, context }),
  });

  return res.json();
}

export async function createSession(context?: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context }),
  });
  const data = await res.json();
  return data.sessionId;
}

export async function fetchTranslations(lang: string): Promise<Record<string, string>> {
  const res = await fetch(`${API_URL}/api/i18n/${lang}`);
  if (!res.ok) return {};
  const data = await res.json();
  return data.translations;
}
