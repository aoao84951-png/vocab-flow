"use client";

import { useEffect, useRef, useState } from "react";

type Location = { label: string; path: string[] };

export default function LocationMenu({ title, ancestors, onHome, onBack, onNavigate }: {
  title: string;
  ancestors: Location[];
  onHome: () => void;
  onBack: () => void;
  onNavigate: (path: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const navigate = (action: () => void) => { setOpen(false); action(); };
  const itemClass = "flex min-h-11 w-full items-center rounded-xl px-3 text-left text-[14px] text-[#4b5058] hover:bg-[#eff7fc] focus-visible:bg-[#eff7fc]";

  return (
    <div ref={root} className="relative mr-3 min-w-0 flex-1">
      <h1 className="text-[28px] font-bold tracking-tight text-[#303236]">
        <button ref={trigger} type="button" onClick={() => setOpen(!open)} aria-expanded={open}
          aria-label={`${title} 이동 메뉴`} className="flex max-w-full items-center gap-2 text-left">
          <span className="truncate">{title}</span>
          <span aria-hidden="true" className="folder-symbol shrink-0 text-[13px]">▽</span>
        </button>
      </h1>
      {open && (
        <nav aria-label="현재 위치 및 이동" className="absolute left-0 top-full z-30 mt-3 w-64 max-w-[calc(100vw-40px)] rounded-2xl border border-[#e4eff7] bg-white p-2 shadow-[0_8px_32px_rgba(66,108,143,0.12)]">
          <button type="button" onClick={() => navigate(onBack)} className={itemClass}>이전 화면</button>
          <div className="my-1 border-t border-[#f0f1f3]" />
          <button type="button" onClick={() => navigate(onHome)} className={itemClass}>전체 단어장</button>
          {ancestors.map(({ label, path }) => (
            <button key={JSON.stringify(path)} type="button" onClick={() => navigate(() => onNavigate(path))} className={itemClass}>
              <span aria-hidden="true" className="folder-symbol mr-2 text-[14px]">→</span>
              <span className="truncate">{label}</span>
            </button>
          ))}
          <p aria-current="location" className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-[#f2f8fc] px-3 text-[14px] font-semibold text-[#303236]">
            <span className="truncate">{title}</span><span className="shrink-0 text-[11px] font-normal text-[#8a8f98]">현재 위치</span>
          </p>
        </nav>
      )}
    </div>
  );
}
