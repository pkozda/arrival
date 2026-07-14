import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LifeEventInspectorCertainty } from '@/components/certainty/LifeEventInspectorCertainty';
import type { LifeEventPlanNode } from '@/lib/product-contract';

function node(partial: Partial<LifeEventPlanNode> & { id: string; title: string }): LifeEventPlanNode {
  return {
    actions: [{ label: 'Register your address', href: '/profile' }],
    satisfied: false,
    blocked: false,
    ...partial,
  } as LifeEventPlanNode;
}

describe('LifeEventInspectorCertainty integration', () => {
  let root: Root | null = null;
  const originalEnv = process.env.NEXT_PUBLIC_CERTAINTY_LAYER_ENABLED;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_CERTAINTY_LAYER_ENABLED = 'false';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_CERTAINTY_LAYER_ENABLED = originalEnv;
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  async function renderIntegration() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    const primary = node({ id: 'registration', title: 'Registration' });

    await act(async () => {
      root!.render(
        <LifeEventInspectorCertainty
          selectedNode={primary}
          primaryAction={primary}
          timeline={[primary]}
          dependencyNodeIds={[]}
          titleForNode={(n) => n.title}
          descriptionForNode={() => 'housing support depends on registration'}
        />
      );
      await Promise.resolve();
    });

    return container;
  }

  it('renders nothing when feature flag is disabled', async () => {
    const container = await renderIntegration();
    expect(container.querySelector('[data-ui-surface="certainty-panel"]')).toBeNull();
  });

  it('renders certainty panel when feature flag is enabled', async () => {
    process.env.NEXT_PUBLIC_CERTAINTY_LAYER_ENABLED = 'true';
    const container = await renderIntegration();
    expect(container.querySelector('[data-ui-surface="certainty-panel"]')).not.toBeNull();
    expect(container.textContent).toContain('Register your address');
  });
});
