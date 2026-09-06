"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowDownUp, Eye, Pencil, Settings2, Trash2 } from "lucide-react";

import { AppearanceActions } from "./AppearanceSettings";

type Props = {
  mode: "list" | "study";
  view: "all" | "unmemorized";
  onToggleView: () => void;
  sort?: "latest" | "oldest";
  onToggleSort?: () => void;
  meanings?: boolean;
  onToggleMeanings?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  disabled?: boolean;
};

export default function WordOptionsMenu(props: Props) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
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
  const row = "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-[#4b5058] hover:bg-[#f0f7fd] focus-visible:outline-2 focus-visible:outline-[#91bad6]";
  const badge = "ml-auto rounded-full bg-[#eaf4fc] px-2.5 py-1 text-xs text-[#4b5058]";
  return (
    <div ref={container} className="relative z-50 shrink-0" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
      <button ref={trigger} type="button" aria-label={props.mode === "list" ? "목록 설정" : "단어 메뉴"} aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => setOpen(value => !value)} className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${open ? "bg-[#eff7fc] text-[#587fa3]" : "text-[#91a8bb] hover:bg-[#f2f8fc]"}`}>
        <Settings2 aria-hidden="true" size={20} strokeWidth={1.7} />
      </button>
      {open && <div id={id} role="group" aria-label={props.mode === "list" ? "목록 설정" : "단어 메뉴"} className="absolute right-0 top-full mt-2 w-[260px] max-w-[calc(100vw-40px)] rounded-2xl border border-[#e3edf5] bg-white p-2 shadow-[0_12px_36px_rgba(40,60,80,0.12)]">
        {props.mode === "list" && <button className={row} onClick={props.onToggleSort} aria-label={`정렬: ${props.sort === "latest" ? "최신순" : "오래된순"}`}><ArrowDownUp size={18} /><span>정렬</span><span className={badge}>{props.sort === "latest" ? "최신순" : "오래된순"}</span></button>}
        <button className={row} onClick={props.onToggleView} aria-label={`보기: ${props.view === "all" ? "전체보기" : "미암기만"}`}><Eye size={18} /><span>보기</span><span className={badge}>{props.view === "all" ? "전체보기" : "미암기만"}</span></button>
        {props.mode === "list" && <button className={row} onClick={props.onToggleMeanings} aria-label={`뜻: ${props.meanings ? "보기" : "숨기기"}`}><Eye size={18} /><span>뜻</span><span className={badge}>{props.meanings ? "보기" : "숨기기"}</span></button>}
        {props.mode === "study" && <>
          <button disabled={props.disabled} className={`${row} disabled:opacity-40`} onClick={() => { setOpen(false); props.onEdit?.(); }}><Pencil size={18} />수정</button>
          <button disabled={props.disabled} className={`${row} disabled:opacity-40`} onClick={() => { setOpen(false); props.onDelete?.(); }}><Trash2 size={18} className="text-[#bf5555]" />삭제</button>
        </>}
        <div className="my-2 border-t border-[#edf1f4]" />
        <AppearanceActions />
      </div>}
    </div>
  );
}
