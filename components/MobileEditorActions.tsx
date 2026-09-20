"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { mobileEditorScrollDelta } from '@/lib/mobileEditorViewport';

// iOS scrolls the visual viewport independently while the keyboard is open.
// Anchor to that viewport instead of a sticky element's document container.
export default function MobileEditorActions({ children }: { children: ReactNode }) {
  const bar = useRef<HTMLDivElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => { setMounted(true); }, []);
  useLayoutEffect(() => {
    if (!mounted) return;
    let fullHeight = window.innerHeight;
    let fullWidth = window.innerWidth;
    const place = (openingKeyboard = false) => {
      const element = bar.current;
      if (!element) return;
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      if (fullWidth !== window.innerWidth) {
        fullWidth = window.innerWidth;
        fullHeight = window.innerHeight;
      }
      fullHeight = Math.max(fullHeight, window.innerHeight);
      const field = document.activeElement;
      const editing = field instanceof HTMLElement &&
        (field.isContentEditable || field.matches('input:not([type="button"]):not([type="submit"]), textarea, select'));
      // Account for Safari's visual viewport and browsers that resize the layout.
      // Multiplying by scale avoids mistaking pinch zoom for a keyboard.
      const keyboardOpen = fullHeight - height * (viewport?.scale ?? 1) > 120;
      const hidden = openingKeyboard || keyboardOpen || !!document.querySelector('[data-word-editor] [data-mobile-formatting]') ||
        (editing && field.getAttribute('inputmode') === 'none');
      element.style.visibility = hidden ? 'hidden' : 'visible';
      element.inert = hidden;
      element.setAttribute('aria-hidden', String(hidden));
      element.style.top = `${(viewport?.offsetTop ?? 0) + height}px`;
      element.style.left = `${viewport?.offsetLeft ?? 0}px`;
      element.style.width = `${viewport?.width ?? window.innerWidth}px`;
      element.style.paddingBottom = 'max(12px, env(safe-area-inset-bottom))';
      // Safari keeps a full-height layout viewport behind the keyboard. Reserve
      // only that obscured portion so native caret scrolling is not clamped back
      // to the pre-keyboard document bottom when the palette spacer disappears.
      const keyboardInset = keyboardOpen ? Math.max(0, document.documentElement.clientHeight - height * (viewport?.scale ?? 1)) : 0;
      if (spacer.current) spacer.current.style.height = hidden ? `${keyboardInset + 12}px` : `${element.getBoundingClientRect().height}px`;
    };
    const update = () => place();
    let settle = 0;
    const revealCaret = () => {
      const field = document.activeElement;
      const element = bar.current;
      const viewport = window.visualViewport;
      if (!(field instanceof HTMLElement) || !field.closest('[data-word-editor]') ||
          !field.isContentEditable || !element || !viewport || field.hasAttribute('data-mobile-formatting')) return;
      const selection = window.getSelection();
      if (!selection?.rangeCount || !field.contains(selection.anchorNode)) return;
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      if (!rect.height) return;
      const viewportBottom = element.getBoundingClientRect().bottom;
      const toolbar = document.querySelector('[data-mobile-selection-toolbar]');
      let remaining = mobileEditorScrollDelta(rect, viewportBottom, viewport.height, toolbar?.getBoundingClientRect().top);
      for (let parent = field.parentElement; parent && Math.abs(remaining) > 1; parent = parent.parentElement) {
        if (parent === document.scrollingElement || !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) continue;
        const before = parent.scrollTop;
        parent.scrollBy({ top: remaining, behavior: 'instant' });
        remaining -= parent.scrollTop - before;
      }
      if (Math.abs(remaining) > 1) window.scrollBy({ top: remaining, behavior: 'instant' });
    };
    const resized = () => {
      place();
      window.clearTimeout(settle);
      // iOS applies its final keyboard pan after dispatching viewport.resize.
      settle = window.setTimeout(revealCaret, 180);
    };
    const focus = (event: FocusEvent) => {
      const field = event.target;
      place(field instanceof HTMLElement &&
        (field.isContentEditable || field.matches('input, textarea, select')));
    };
    let frame = 0;
    const blur = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    place();
    const observer = new ResizeObserver(update);
    if (bar.current) observer.observe(bar.current);
    window.visualViewport?.addEventListener('resize', resized);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', blur);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', blur);
      observer.disconnect();
      window.visualViewport?.removeEventListener('resize', resized);
      window.visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [mounted]);

  return <>
    <div ref={spacer} aria-hidden="true" style={{ height: 72 }} />
    {mounted && createPortal(<div ref={bar} data-mobile-editor-actions
      className="fixed left-0 top-[100dvh] z-30 w-full -translate-y-full border-t border-[#edf0f3] bg-white pt-3 pb-3">
      <div className="mx-auto flex w-full max-w-[430px] items-center gap-2 px-5">{children}</div>
    </div>, document.body)}
  </>;
}
