import { useEffect, type RefObject } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Dialog focus handling: moves focus into `ref` while active, keeps Tab inside it, and
 * hands focus back to whatever had it when the dialog closes.
 * @param ref dialog root; needs tabIndex={-1}
 * @param active false while another layer sits on top
 */
export function useDialogFocus(ref: RefObject<HTMLElement>, active: boolean): void {
  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      const current = document.activeElement;
      if (event.shiftKey && (current === first || current === root)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    root.addEventListener('keydown', onKeyDown);
    return () => {
      root.removeEventListener('keydown', onKeyDown);
      // The opener may be gone (e.g. its sector collapsed); focus() on a detached node is a no-op.
      previous?.focus({ preventScroll: true });
    };
  }, [ref, active]);
}
