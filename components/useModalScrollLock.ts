"use client";
import { useLayoutEffect } from "react";

export default function useModalScrollLock(locked: boolean) {
  useLayoutEffect(() => {
    if (!locked) return;
    const body = document.body, html = document.documentElement;
    const x = window.scrollX, y = window.scrollY;
    const saved = { position: body.style.position, top: body.style.top, left: body.style.left, width: body.style.width, overflow: body.style.overflow, htmlOverflow: html.style.overflow };
    body.style.position = "fixed";
    body.style.top = `${-y}px`;
    body.style.left = `${-x}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    let startY = 0;
    const start = (event: TouchEvent) => { startY = event.touches[0]?.clientY ?? 0; };
    const move = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-bottom-panel-scroll]") : null;
      const currentY = event.touches[0].clientY, delta = currentY - startY;
      startY = currentY;
      if (!target || target.scrollHeight <= target.clientHeight + 1 || (delta > 0 && target.scrollTop <= 0) || (delta < 0 && target.scrollTop + target.clientHeight >= target.scrollHeight - 1)) {
        if (event.cancelable) event.preventDefault();
      }
    };
    document.addEventListener("touchstart", start, { passive: true, capture: true });
    document.addEventListener("touchmove", move, { passive: false, capture: true });
    return () => {
      document.removeEventListener("touchstart", start, true);
      document.removeEventListener("touchmove", move, true);
      Object.assign(body.style, { position: saved.position, top: saved.top, left: saved.left, width: saved.width, overflow: saved.overflow });
      html.style.overflow = saved.htmlOverflow;
      const behavior = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto";
      window.scrollTo(x, y);
      html.style.scrollBehavior = behavior;
    };
  }, [locked]);
}
