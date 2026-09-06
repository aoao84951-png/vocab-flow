"use client";

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
  const font = useFont();
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
    <div ref={panelRef} className="relative">
      <button ref={triggerRef} type="button" aria-label="화면 설정" title="화면 설정" aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`flex h-[38px] w-[38px] items-center justify-center rounded-full transition-colors ${open ? "bg-[#f3eff9] text-[#75639b]" : "text-[#a399b3] hover:bg-[#f7f4fb]"}`}
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-30 w-56 rounded-2xl border border-[#eee8f5] bg-white p-4 shadow-[0_8px_32px_rgba(94,77,125,0.12)]">
          <p className="mb-3 text-[12px] font-semibold text-[#756b85]">글꼴</p>
          <div className="flex rounded-xl bg-[#f7f4fb] p-1" role="group" aria-label="앱 글꼴">
            {([['default', '기본'], ['summer', '여름소리']] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={font === value}
                onClick={() => {
                  currentFont = value;
                  try { localStorage.setItem(FONT_KEY, value); } catch { /* Keep the in-memory preference when storage is unavailable. */ }
                  document.documentElement.dataset.appFont = value;
                  window.dispatchEvent(new Event(CHANGE_EVENT));
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-[13px] transition-colors ${font === value ? "bg-white font-semibold text-[#75639b] shadow-sm" : "text-[#93899f]"}`}
                style={value === "summer" ? { fontFamily: '"Summer Melody", sans-serif', fontWeight: 600 } : undefined}
              >{label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
