import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionRecreatedNotice } from '@/components/SessionRecreatedNotice';

function createTabEvent(shiftKey = false): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
}

describe('SessionRecreatedNotice', () => {
  let root: Root | null = null;
  const onContinue = vi.fn();

  beforeEach(() => {
    onContinue.mockReset();
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

  it('focuses Continue and keeps keyboard focus inside the dialog', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <SessionRecreatedNotice
          open
          title="A new Atlas session has started"
          message="Your previous local session is no longer available."
          continueLabel="Continue"
          onContinue={onContinue}
        />
      );
      await Promise.resolve();
    });

    const dialog = container.querySelector('.session-recreated-notice__dialog');
    const continueButton = container.querySelector(
      '.session-recreated-notice__btn--primary'
    ) as HTMLButtonElement;

    expect(document.activeElement).toBe(continueButton);

    await act(async () => {
      window.dispatchEvent(createTabEvent());
      window.dispatchEvent(createTabEvent(true));
    });

    expect(document.activeElement).toBe(continueButton);
    expect(dialog?.contains(document.activeElement)).toBe(true);
  });

  it('dismisses on Escape without changing existing behavior', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <SessionRecreatedNotice
          open
          title="A new Atlas session has started"
          message="Your previous local session is no longer available."
          continueLabel="Continue"
          onContinue={onContinue}
        />
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

    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
