"use client";

import { RotateCw, Settings2 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const FONT_KEY = "voca-font";
const CHANGE_EVENT = "voca-font-change";
let currentFont = "default";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getFont() {
  try { currentFont = localStorage.getItem(FONT_KEY) === "summer" ? "summer" : "default"; } catch { /* Keep the in-memory preference when storage is unavailable. */ }
  return currentFont;
}

function useFont() {
  return useSyncExternalStore(subscribe, getFont, () => "default");
}

export function FontPreference() {
  const font = useFont();
  useEffect(() => {
    document.documentElement.dataset.appFont = font;
  }, [font]);
  return null;
}

export default function AppearanceSettings() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={panelRef} className="relative z-[60] shrink-0" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
      <button ref={triggerRef} type="button" aria-label="화면 설정" title="화면 설정" aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`flex h-[38px] w-[38px] items-center justify-center rounded-full transition-colors ${open ? "bg-[#eff7fc] text-[#303236]" : "text-[#91a8bb] hover:bg-[#f2f8fc]"}`}
      >
        <Settings2 aria-hidden="true" size={20} strokeWidth={1.7} />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-30 w-56 rounded-2xl border border-[#e4eff7] bg-white p-2 shadow-[0_8px_32px_rgba(66,108,143,0.12)]">
          <AppearanceActions />
        </div>
      )}
    </div>
  );
}

export function AppearanceActions() {
  const font = useFont();
  return <>
          <button type="button"
            aria-label={`글꼴 변경 (현재: ${font === "summer" ? "여름소리" : "기본"})`}
            onClick={() => {
              const nextFont = font === "summer" ? "default" : "summer";
              currentFont = nextFont;
              try { localStorage.setItem(FONT_KEY, nextFont); } catch { /* Keep the preference in memory when storage is unavailable. */ }
              document.documentElement.dataset.appFont = nextFont;
              window.dispatchEvent(new Event(CHANGE_EVENT));
            }}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[#666a70] transition-colors hover:bg-[#f5f9fc]"
          >
            <span aria-hidden="true" className="font-serif text-[22px] leading-none">T</span>
            <span className="flex-1 text-[14px] font-medium">글꼴</span>
            <span aria-live="polite" className="rounded-full bg-[#eaf4fb] px-2.5 py-1 text-[11px] font-medium text-[#626970]">{font === "summer" ? "여름소리" : "기본"}</span>
          </button>
          <button type="button" onClick={() => window.location.reload()}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[#666a70] transition-colors hover:bg-[#f5f9fc]">
            <RotateCw aria-hidden="true" size={20} strokeWidth={1.7} />
            <span className="text-[14px] font-medium">새로고침</span>
          </button>
  </>;
}
