import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getFocusableElements, handleFocusTrapKeyDown } from '@/lib/a11y/focus-trap';

function createTabEvent(shiftKey = false): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
}

describe('focus trap', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = '';
  });

  it('keeps focus on a single focusable element', () => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Continue';
    container.appendChild(button);
    button.focus();

    const event = createTabEvent();
    handleFocusTrapKeyDown(event, container);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button);

    const shiftEvent = createTabEvent(true);
    handleFocusTrapKeyDown(shiftEvent, container);

    expect(shiftEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button);
  });

  it('cycles between multiple focusable elements', () => {
    const first = document.createElement('button');
    first.type = 'button';
    first.textContent = 'First';
    const second = document.createElement('button');
    second.type = 'button';
    second.textContent = 'Second';
    container.append(first, second);

    expect(getFocusableElements(container)).toEqual([first, second]);

    second.focus();

    const tabEvent = createTabEvent();
    handleFocusTrapKeyDown(tabEvent, container);
    expect(tabEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    const shiftEvent = createTabEvent(true);
    handleFocusTrapKeyDown(shiftEvent, container);
    expect(shiftEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(second);
  });
});
