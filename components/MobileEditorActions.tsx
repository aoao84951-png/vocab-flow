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
    const place = () => {
      const element = bar.current;
      if (!element) return;
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      element.style.top = `${(viewport?.offsetTop ?? 0) + height}px`;
      element.style.left = `${viewport?.offsetLeft ?? 0}px`;
      element.style.width = `${viewport?.width ?? window.innerWidth}px`;
      element.style.paddingBottom = window.innerHeight - height > 120
        ? '12px' : 'max(12px, env(safe-area-inset-bottom))';
      if (spacer.current) spacer.current.style.height = `${element.getBoundingClientRect().height}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    if (bar.current) observer.observe(bar.current);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    window.addEventListener('resize', place);
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
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
