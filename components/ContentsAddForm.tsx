"use client";

import { useEffect, useRef, useState } from "react";
import BookCoverInput from "./BookCoverInput";

type Values = { title: string; desc: string; coverImage: string; isBook: boolean };
type Props = { kind: "folder" | "day"; root: boolean; parentTitle?: string; onCancel: () => void; onSubmit: (values: Values) => void };

export default function ContentsAddForm({ kind, root, parentTitle, onCancel, onSubmit }: Props) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [isBook, setIsBook] = useState(false);
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const label = kind === "day" ? "Day" : root ? "단어장" : "하위 목차";
  useEffect(() => {
    const panel = form.current?.closest<HTMLElement>("[data-bottom-panel-scroll]");
    if (!panel) return;
    let frame = 0;
    const revealBottom = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => panel.scrollTo({ top: panel.scrollHeight, behavior: "instant" }));
    };
    input.current?.focus({ preventScroll: true });
    revealBottom();
    // Re-align after the dialog or the on-screen keyboard changes its visible height.
    const resize = new ResizeObserver(revealBottom);
    resize.observe(panel);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", revealBottom);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); viewport?.removeEventListener("resize", revealBottom); };
  }, []);
  return <form ref={form} aria-label={`${label} 추가`} className="my-3 space-y-2 rounded-xl border border-[#e7edf2] bg-[#f8fafc] p-3" onSubmit={event => { event.preventDefault(); if (title.trim() && !busy) onSubmit({ title: title.trim(), desc: desc.trim(), coverImage, isBook }); }}>
    <div className="flex items-center justify-between gap-2"><h4 className="text-[13px] text-[#505660]">{label} 추가</h4><button type="button" onClick={onCancel} className="min-h-8 px-2 text-[11px] text-[#8196a7]">취소</button></div>
    {parentTitle && <p className="break-words text-[11px] text-[#8b9aa7]">{parentTitle} 안에 추가</p>}
    <input ref={input} aria-label={`${label} 이름`} placeholder={kind === "day" ? "예: Day 01" : `${label} 이름`} value={title} onChange={event => setTitle(event.target.value)} className="h-9 w-full rounded-lg border border-[#e1e9ef] bg-white px-2 text-[12px] outline-none focus:border-[#9bbbd2]" />
    {kind === "folder" && <><input aria-label="설명" placeholder="설명 (선택)" value={desc} onChange={event => setDesc(event.target.value)} className="h-8 w-full rounded-lg border border-[#e1e9ef] bg-white px-2 text-[12px]" /><BookCoverInput value={coverImage} onChange={setCoverImage} isBook={isBook} onBookChange={setIsBook} onBusyChange={setBusy} /></>}
    <div className="flex justify-end"><button type="submit" disabled={!title.trim() || busy} className="min-h-8 rounded-lg bg-[#e2eff8] px-4 text-[12px] text-[#527895] disabled:opacity-40">추가하기</button></div>
  </form>;
}
