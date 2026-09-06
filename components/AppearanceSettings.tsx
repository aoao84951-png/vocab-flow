"use client";

import { useEffect, useSyncExternalStore } from "react";

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
  return (
    <div className="mt-5 flex items-center gap-3 text-[12px] text-[#858b94]">
      <span>글꼴</span>
      <div className="inline-flex rounded-full bg-[#f5f5f4] p-1" role="group" aria-label="앱 글꼴">
        {([['default', '기본'], ['summer', '여름소리']] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={font === value}
            onClick={() => {
              currentFont = value;
              try { localStorage.setItem(FONT_KEY, value); } catch { /* Keep the in-memory preference when storage is unavailable. */ }
              document.documentElement.dataset.appFont = value;
              window.dispatchEvent(new Event(CHANGE_EVENT));
            }}
            className={`rounded-full px-3 py-1.5 transition-colors ${font === value ? "bg-white text-[#303236] shadow-sm" : "text-[#858b94]"}`}
            style={value === "summer" ? { fontFamily: '"Summer Melody", sans-serif' } : undefined}
          >{label}</button>
        ))}
      </div>
    </div>
  );
}
