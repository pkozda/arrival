import { buildAuthHeaders, readStoredSessionId } from '@/lib/api';
import { resetRuntimeSessionState } from '@/lib/life-event/runtime/runtime-store';
import type { DemoPersonaId } from '@arrival-atlas/life-event-demo/personas';
import { isDevToolsUiEnabled } from '@/lib/dev-tools/reset-user-data';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type DemoPresetLoadResult = {
  presetId: DemoPersonaId;
  sessionId: string;
  plan: {
    currentLifeState: string;
    planningSeverity: string;
    currentFocus: string;
    nextBestActions: string[];
    activeBlocks: string[];
  };
};

export type DemoPresetListItem = {
  id: DemoPersonaId;
  title: string;
  tagline: string;
};

export { isDevToolsUiEnabled };

export async function fetchDemoPresets(sessionId: string): Promise<DemoPresetListItem[]> {
  const res = await fetch(`${API_URL}/api/dev/demo/presets`, {
    headers: buildAuthHeaders({ sessionId }),
  });

  if (!res.ok) {
    throw new Error(`Failed to load demo presets (${res.status})`);
  }

  const body = (await res.json()) as { presets: DemoPresetListItem[] };
  return body.presets;
}

export async function loadDemoPreset(
  sessionId: string,
  presetId: DemoPersonaId
): Promise<DemoPresetLoadResult> {
  resetRuntimeSessionState();

  const res = await fetch(`${API_URL}/api/dev/demo/load-preset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders({ sessionId }),
    },
    body: JSON.stringify({ presetId }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to load demo preset (${res.status})`);
  }

  return res.json() as Promise<DemoPresetLoadResult>;
}

export function readActiveSessionId(): string | null {
  return readStoredSessionId();
}
