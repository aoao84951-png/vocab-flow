"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

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
      const hidden = openingKeyboard || keyboardOpen ||
        (editing && field.getAttribute('inputmode') === 'none');
      element.style.visibility = hidden ? 'hidden' : 'visible';
      element.inert = hidden;
      element.setAttribute('aria-hidden', String(hidden));
      element.style.top = `${(viewport?.offsetTop ?? 0) + height}px`;
      element.style.left = `${viewport?.offsetLeft ?? 0}px`;
      element.style.width = `${viewport?.width ?? window.innerWidth}px`;
      element.style.paddingBottom = 'max(12px, env(safe-area-inset-bottom))';
      if (spacer.current) spacer.current.style.height = `${element.getBoundingClientRect().height}px`;
    };
    const update = () => place();
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
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', blur);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', blur);
      observer.disconnect();
      window.visualViewport?.removeEventListener('resize', update);
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
