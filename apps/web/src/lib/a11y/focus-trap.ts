const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute('disabled') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      element.tabIndex !== -1
  );
}

export function handleFocusTrapKeyDown(event: KeyboardEvent, container: HTMLElement): void {
  if (event.key !== 'Tab') {
    return;
  }

  const focusable = getFocusableElements(container);
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  event.preventDefault();

  if (focusable.length === 1) {
    focusable[0]!.focus();
    return;
  }

  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  const active = document.activeElement as HTMLElement | null;
  const currentIndex = active ? focusable.indexOf(active) : -1;

  if (event.shiftKey) {
    if (currentIndex <= 0) {
      last.focus();
      return;
    }

    focusable[currentIndex - 1]!.focus();
    return;
  }

  if (currentIndex === -1 || currentIndex >= focusable.length - 1) {
    first.focus();
    return;
  }

  focusable[currentIndex + 1]!.focus();
}
