import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ATLAS_DEMO_LEGACY_SESSION_KEY,
  ATLAS_DEMO_STORAGE_KEY,
} from '@/components/atlas-home/atlas-demo-state';
import { AtlasHomeProvider, useAtlasHomeDemo } from '@/components/atlas-home/AtlasHomeProvider';

function DemoStateProbe({ onRender }: { onRender: (isExploringAtlas: boolean) => void }) {
  const { isExploringAtlas } = useAtlasHomeDemo();
  onRender(isExploringAtlas);
  return <div data-exploring={isExploringAtlas ? '1' : '0'} />;
}

describe('AtlasHomeProvider', () => {
  let root: Root | null = null;
  const local = new Map<string, string>();
  const session = new Map<string, string>();
  const renderStates: boolean[] = [];

  beforeEach(() => {
    local.clear();
    session.clear();
    renderStates.length = 0;

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => local.get(key) ?? null,
      setItem: (key: string, value: string) => {
        local.set(key, value);
      },
      removeItem: (key: string) => {
        local.delete(key);
      },
    });
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => {
        session.set(key, value);
      },
      removeItem: (key: string) => {
        session.delete(key);
      },
    });
    vi.stubGlobal('window', {
      localStorage: globalThis.localStorage,
      sessionStorage: globalThis.sessionStorage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    vi.unstubAllGlobals();
  });

  it('renders exploring state on the first paint when demo is active', async () => {
    local.set(ATLAS_DEMO_STORAGE_KEY, '1');

    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <AtlasHomeProvider>
          <DemoStateProbe
            onRender={(isExploringAtlas) => {
              renderStates.push(isExploringAtlas);
            }}
          />
        </AtlasHomeProvider>
      );
      await Promise.resolve();
    });

    expect(renderStates[0]).toBe(true);
    expect(container.querySelector('[data-exploring="1"]')).not.toBeNull();
  });

  it('renders guest state on the first paint when demo is inactive', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <AtlasHomeProvider>
          <DemoStateProbe
            onRender={(isExploringAtlas) => {
              renderStates.push(isExploringAtlas);
            }}
          />
        </AtlasHomeProvider>
      );
      await Promise.resolve();
    });

    expect(renderStates[0]).toBe(false);
    expect(container.querySelector('[data-exploring="0"]')).not.toBeNull();
  });

  it('migrates legacy sessionStorage on initial render', async () => {
    session.set(ATLAS_DEMO_LEGACY_SESSION_KEY, '1');

    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <AtlasHomeProvider>
          <DemoStateProbe
            onRender={(isExploringAtlas) => {
              renderStates.push(isExploringAtlas);
            }}
          />
        </AtlasHomeProvider>
      );
      await Promise.resolve();
    });

    expect(renderStates[0]).toBe(true);
    expect(local.get(ATLAS_DEMO_STORAGE_KEY)).toBe('1');
    expect(session.has(ATLAS_DEMO_LEGACY_SESSION_KEY)).toBe(false);
  });

  it('updates state when a cross-tab storage event arrives', async () => {
    local.set(ATLAS_DEMO_STORAGE_KEY, '1');

    let storageHandler: ((event: StorageEvent) => void) | undefined;
    vi.mocked(window.addEventListener).mockImplementation((type, listener) => {
      if (type === 'storage') {
        storageHandler = listener as (event: StorageEvent) => void;
      }
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <AtlasHomeProvider>
          <DemoStateProbe
            onRender={(isExploringAtlas) => {
              renderStates.push(isExploringAtlas);
            }}
          />
        </AtlasHomeProvider>
      );
      await Promise.resolve();
    });

    expect(renderStates.at(-1)).toBe(true);

    await act(async () => {
      storageHandler?.({
        key: ATLAS_DEMO_STORAGE_KEY,
        newValue: null,
      } as StorageEvent);
    });

    expect(renderStates.at(-1)).toBe(false);
    expect(container.querySelector('[data-exploring="0"]')).not.toBeNull();
  });
});
