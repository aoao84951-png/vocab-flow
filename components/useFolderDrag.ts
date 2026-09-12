"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { FolderAction } from "@/lib/folderActions";

type Drop = { id: string; position: "before" | "after" | "inside"; destination: string };
type Drag = { id: string; title: string; x: number; y: number; drop: Drop | null };

export default function useFolderDrag(container: RefObject<HTMLDivElement | null>, enabled: boolean, onMove: (action: FolderAction) => void) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const callback = useRef(onMove);
  useEffect(() => { callback.current = onMove; }, [onMove]);
  useEffect(() => {
    const root = container.current;
    if (!enabled || !root) return;
    let pending: { id: string; title: string; x: number; y: number } | null = null;
    let active: Drag | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    let suppressClick = false;
    let lastTouch = 0;
    const clear = () => { clearTimeout(timer); cancelAnimationFrame(frame); pending = null; active = null; setDrag(null); };
    const locate = (x: number, y: number): Drop | null => {
      const row = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-folder-row]");
      if (!row || !root.contains(row) || !active) return null;
      const path: string[] = JSON.parse(row.dataset.folderPath!);
      if (path.includes(active.id)) return null;
      const rect = row.getBoundingClientRect();
      const ratio = (y - rect.top) / rect.height;
      const position = ratio < .25 ? "before" : ratio > .75 ? "after" : "inside";
      return { id: row.dataset.folderRow!, position, destination: position === "inside" ? path.at(-1)! : path.at(-2) || "" };
    };
    const tick = () => {
      if (!active) return;
      const rect = root.getBoundingClientRect();
      if (active.x >= rect.left && active.x <= rect.right) {
        const speed = active.y < rect.top + 40 ? -8 : active.y > rect.bottom - 40 ? 8 : 0;
        if (speed) root.scrollTop += speed;
      }
      active = { ...active, drop: locate(active.x, active.y) };
      setDrag(active);
      frame = requestAnimationFrame(tick);
    };
    const start = (target: EventTarget | null, x: number, y: number) => {
      if (!(target instanceof Element) || !target.closest("[data-folder-grab]")) return;
      const row = target.closest<HTMLElement>("[data-folder-row]");
      if (!row) return;
      clear(); suppressClick = false;
      pending = { id: row.dataset.folderRow!, title: row.dataset.folderTitle!, x, y };
      timer = setTimeout(() => {
        if (!pending) return;
        active = { ...pending, drop: null }; suppressClick = true;
        setDrag(active); frame = requestAnimationFrame(tick);
      }, 420);
    };
    const move = (event: Event, x: number, y: number) => {
      if (active) { if (event.cancelable) event.preventDefault(); active = { ...active, x, y, drop: locate(x, y) }; setDrag(active); }
      else if (pending && Math.hypot(x - pending.x, y - pending.y) > 9) clear();
    };
    const finish = () => {
      if (active?.drop) {
        const { id, drop } = active;
        callback.current({ kind: "move", id, destination: drop.destination, ...(drop.position !== "inside" ? { relativeTo: drop.id, placement: drop.position } : {}) });
      }
      clear();
    };
    const touchStart = (e: TouchEvent) => { lastTouch = Date.now(); if (e.touches.length !== 1) { clear(); return; } start(e.target, e.touches[0].clientX, e.touches[0].clientY); };
    const touchMove = (e: TouchEvent) => { if (e.touches.length !== 1) { clear(); return; } move(e, e.touches[0].clientX, e.touches[0].clientY); };
    const mouseStart = (e: MouseEvent) => { if (Date.now() - lastTouch < 1000) return; if (e.button === 0) start(e.target, e.clientX, e.clientY); };
    const mouseMove = (e: MouseEvent) => move(e, e.clientX, e.clientY);
    const click = (e: MouseEvent) => { if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; } };
    const context = (e: Event) => { if (pending || active) e.preventDefault(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") clear(); };
    root.addEventListener("touchstart", touchStart, { passive: true });
    root.addEventListener("mousedown", mouseStart);
    root.addEventListener("click", click, true);
    root.addEventListener("contextmenu", context);
    document.addEventListener("touchmove", touchMove, { passive: false });
    document.addEventListener("touchend", finish);
    document.addEventListener("touchcancel", clear);
    document.addEventListener("mousemove", mouseMove);
    document.addEventListener("mouseup", finish);
    document.addEventListener("keydown", key);
    window.addEventListener("blur", clear);
    return () => {
      clear();
      root.removeEventListener("touchstart", touchStart); root.removeEventListener("mousedown", mouseStart);
      root.removeEventListener("click", click, true); root.removeEventListener("contextmenu", context);
      document.removeEventListener("touchmove", touchMove); document.removeEventListener("touchend", finish);
      document.removeEventListener("touchcancel", clear); document.removeEventListener("mousemove", mouseMove);
      document.removeEventListener("mouseup", finish); document.removeEventListener("keydown", key);
      window.removeEventListener("blur", clear);
    };
  }, [container, enabled]);
  return drag;
}
