'use client';

import { useCallback, useEffect, useState } from 'react';
import { buildAuthHeaders, readStoredSessionId, readStoredToken } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type BenefitNode = {
  id: string;
  title: string;
  category: string;
  status: 'active' | 'deprecated' | 'replaced';
  benefitType: string;
  valueEstimate: { min: number; max: number; currency: string; period: string };
};

type AdminNodesResponse = {
  nodes: BenefitNode[];
  updateLogs: Array<{ id: string; tier: string; ingested: number; updated: number }>;
};

async function mbdeAdminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const sessionId = readStoredSessionId();
  const token = readStoredToken();
  const headers = buildAuthHeaders({ sessionId, token });

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers ?? {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export function MbdeAdminDashboard() {
  const [nodes, setNodes] = useState<BenefitNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadNodes = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const data = await mbdeAdminFetch<AdminNodesResponse>('/api/benefits/admin/nodes');
      setNodes(data.nodes);
      if (!selectedId && data.nodes[0]) {
        setSelectedId(data.nodes[0].id);
        setEditorValue(JSON.stringify(data.nodes[0], null, 2));
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load benefit graph');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void loadNodes();
  }, [loadNodes]);

  const selected = nodes.find((node) => node.id === selectedId) ?? null;

  const handleSelect = (id: string) => {
    const node = nodes.find((item) => item.id === id);
    if (!node) {
      return;
    }
    setSelectedId(id);
    setEditorValue(JSON.stringify(node, null, 2));
  };

  const handleSave = async () => {
    if (!selectedId) {
      return;
    }

    try {
      const patch = JSON.parse(editorValue) as Record<string, unknown>;
      await mbdeAdminFetch(`/api/benefits/admin/nodes/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setStatus('Saved benefit node');
      await loadNodes();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Save failed');
    }
  };

  const handleDeprecate = async () => {
    if (!selectedId) {
      return;
    }

    try {
      await mbdeAdminFetch(`/api/benefits/admin/nodes/${selectedId}/deprecate`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setStatus('Marked deprecated');
      await loadNodes();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Deprecate failed');
    }
  };

  return (
    <div className="mbde-admin" data-ui-surface="mbde-admin">
      <header className="mbde-admin__header">
        <h1>Maximum Benefits Engine</h1>
        <p>Admin graph · rules · ingestion status</p>
      </header>

      {status && <p className="mbde-admin__status">{status}</p>}
      {loading && <p>Loading benefit graph…</p>}

      <div className="mbde-admin__layout">
        <aside className="mbde-admin__list" aria-label="Benefit nodes">
          {nodes.map((node) => (
            <button
              key={node.id}
              type="button"
              className={`mbde-admin__list-item${selectedId === node.id ? ' is-active' : ''}`}
              onClick={() => handleSelect(node.id)}
            >
              <strong>{node.title}</strong>
              <span>
                {node.category} · {node.status}
              </span>
            </button>
          ))}
        </aside>

        <section className="mbde-admin__editor">
          <h2>{selected?.title ?? 'Select a benefit'}</h2>
          <textarea
            className="mbde-admin__textarea"
            value={editorValue}
            onChange={(event) => setEditorValue(event.target.value)}
            rows={24}
            spellCheck={false}
          />
          <div className="mbde-admin__actions">
            <button type="button" className="mbde-admin__btn" onClick={() => void handleSave()}>
              Save rules
            </button>
            <button
              type="button"
              className="mbde-admin__btn mbde-admin__btn--danger"
              onClick={() => void handleDeprecate()}
            >
              Mark deprecated
            </button>
            <button type="button" className="mbde-admin__btn" onClick={() => void loadNodes()}>
              Refresh
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
