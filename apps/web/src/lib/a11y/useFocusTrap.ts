'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { getFocusableElements, handleFocusTrapKeyDown } from '@/lib/a11y/focus-trap';

type UseFocusTrapOptions = {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onEscape?: () => void;
  restoreFocus?: boolean;
};

export function useFocusTrap({
  open,
  containerRef,
  initialFocusRef,
  onEscape,
  restoreFocus = true,
}: UseFocusTrapOptions): void {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const focusInitial = (): void => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }

      const container = containerRef.current;
      if (!container) {
        return;
      }

      getFocusableElements(container)[0]?.focus();
    };

    focusInitial();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }

      const container = containerRef.current;
      if (container) {
        handleFocusTrapKeyDown(event, container);
      }
    };

    const onFocusIn = (event: FocusEvent): void => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && !container.contains(target)) {
        getFocusableElements(container)[0]?.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);

      if (restoreFocus) {
        previouslyFocusedRef.current?.focus?.();
      }
    };
  }, [open, containerRef, initialFocusRef, onEscape, restoreFocus]);
}
