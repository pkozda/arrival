import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { useFocusTrap } from '@/lib/a11y/useFocusTrap';

function createTabEvent(shiftKey = false): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
}

function FocusTrapFixture({
  open,
  onEscape,
}: {
  open: boolean;
  onEscape?: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useFocusTrap({
    open,
    containerRef: dialogRef,
    initialFocusRef: primaryRef,
    onEscape,
  });

  if (!open) {
    return null;
  }

  return (
    <div ref={dialogRef}>
      <button ref={primaryRef} type="button">
        Primary
      </button>
      <button type="button">Secondary</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  let root: Root | null = null;
  const onEscape = vi.fn();

  beforeEach(() => {
    onEscape.mockReset();
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

  it('focuses the primary action on open', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<FocusTrapFixture open onEscape={onEscape} />);
      await Promise.resolve();
    });

    expect(document.activeElement?.textContent).toBe('Primary');
  });

  it('cycles Tab and Shift+Tab within the dialog', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<FocusTrapFixture open onEscape={onEscape} />);
      await Promise.resolve();
    });

    const primary = container.querySelector('button') as HTMLButtonElement;
    const secondary = container.querySelectorAll('button')[1] as HTMLButtonElement;

    expect(document.activeElement).toBe(primary);

    await act(async () => {
      window.dispatchEvent(createTabEvent());
    });
    expect(document.activeElement).toBe(secondary);

    await act(async () => {
      window.dispatchEvent(createTabEvent());
    });
    expect(document.activeElement).toBe(primary);

    await act(async () => {
      window.dispatchEvent(createTabEvent(true));
    });
    expect(document.activeElement).toBe(secondary);
  });

  it('calls onEscape when Escape is pressed', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<FocusTrapFixture open onEscape={onEscape} />);
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

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the previously focused element on close', async () => {
    const container = document.createElement('div');
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.textContent = 'Trigger';
    document.body.append(trigger, container);
    trigger.focus();

    root = createRoot(container);

    await act(async () => {
      root!.render(<FocusTrapFixture open onEscape={onEscape} />);
      await Promise.resolve();
    });

    expect(document.activeElement?.textContent).toBe('Primary');

    await act(async () => {
      root!.render(<FocusTrapFixture open={false} onEscape={onEscape} />);
      await Promise.resolve();
    });

    expect(document.activeElement).toBe(trigger);
  });

  it('removes listeners on unmount', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<FocusTrapFixture open onEscape={onEscape} />);
      await Promise.resolve();
    });

    const keydownAdds = addSpy.mock.calls.filter(([type]) => type === 'keydown').length;
    expect(keydownAdds).toBeGreaterThan(0);

    await act(async () => {
      root!.unmount();
    });

    const keydownRemoves = removeSpy.mock.calls.filter(([type]) => type === 'keydown').length;
    expect(keydownRemoves).toBeGreaterThanOrEqual(keydownAdds);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('pulls focus back into the dialog when it escapes', async () => {
    const container = document.createElement('div');
    const outsideButton = document.createElement('button');
    outsideButton.type = 'button';
    outsideButton.textContent = 'Outside';
    document.body.append(outsideButton, container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<FocusTrapFixture open onEscape={onEscape} />);
      await Promise.resolve();
    });

    await act(async () => {
      outsideButton.focus();
      outsideButton.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });

    expect(container.contains(document.activeElement)).toBe(true);
  });
});
