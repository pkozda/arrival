import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTranslations } from '@arrival-atlas/core';
import { LeaveDemoConfirm } from '@/components/atlas-home/LeaveDemoConfirm';

vi.mock('@/components/AppProvider', () => ({
  useApp: () => ({
    t: (key: string) => getTranslations('en')[key] ?? key,
  }),
}));

function createTabEvent(shiftKey = false): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
}

describe('LeaveDemoConfirm', () => {
  let root: Root | null = null;
  const onCancel = vi.fn();
  const onConfirm = vi.fn();

  beforeEach(() => {
    onCancel.mockReset();
    onConfirm.mockReset();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    document.body.innerHTML = '';
  });

  it('focuses Start over and traps keyboard focus inside the dialog', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <LeaveDemoConfirm open leaving={false} onCancel={onCancel} onConfirm={onConfirm} />
      );
      await Promise.resolve();
    });

    const dialog = container.querySelector('.leave-demo-confirm__dialog');
    const primary = container.querySelector(
      '.leave-demo-confirm__btn--primary'
    ) as HTMLButtonElement;
    const secondary = container.querySelector(
      '.leave-demo-confirm__btn--ghost'
    ) as HTMLButtonElement;

    expect(document.activeElement).toBe(primary);
    expect(primary.textContent).toContain('Start over');

    await act(async () => {
      window.dispatchEvent(createTabEvent());
    });
    expect(document.activeElement).toBe(secondary);

    await act(async () => {
      window.dispatchEvent(createTabEvent());
    });
    expect(document.activeElement).toBe(primary);
    expect(dialog?.contains(document.activeElement)).toBe(true);
  });

  it('dismisses with Escape using existing cancel behavior', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <LeaveDemoConfirm open leaving={false} onCancel={onCancel} onConfirm={onConfirm} />
      );
      await Promise.resolve();
    });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        })
      );
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
