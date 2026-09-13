"use client";
import { useState } from "react";
import { ArrowUp, ArrowDown, Pencil, X } from "lucide-react";

type Props = { title: string; first: boolean; last: boolean; onClose: () => void; onSave: (title: string) => void; onMove: (direction: "up" | "down") => void };
export default function DayInlineActions({ title, first, last, onClose, onSave, onMove }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  return <div aria-label={`${title} 관리 영역`} className="mb-2 rounded-xl border border-[#e7edf2] bg-[#f8fafc] p-2 text-[11px] text-[#687887]">
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => setEditing(true)} className="flex min-h-8 items-center gap-1 px-1"><Pencil size={13} />수정</button>
      <button type="button" disabled={first} onClick={() => onMove("up")} className="flex min-h-8 items-center gap-1 px-1 disabled:opacity-30"><ArrowUp size={13} />위로</button>
      <button type="button" disabled={last} onClick={() => onMove("down")} className="flex min-h-8 items-center gap-1 px-1 disabled:opacity-30"><ArrowDown size={13} />아래로</button>
      <button type="button" aria-label="Day 관리 닫기" onClick={onClose} className="ml-auto flex h-8 w-8 items-center justify-center"><X size={14} /></button>
    </div>
    {editing && <form className="mt-1 flex gap-2" onSubmit={event => { event.preventDefault(); if (value.trim()) onSave(value.trim()); }}>
      <input autoFocus aria-label="Day 이름" value={value} onChange={event => setValue(event.target.value)} className="h-8 min-w-0 flex-1 rounded-lg border border-[#e1e9ef] bg-white px-2 text-[12px] outline-none focus:border-[#9bbbd2]" />
      <button disabled={!value.trim()} className="rounded-lg bg-[#e2eff8] px-3 text-[#527895] disabled:opacity-40">저장</button>
    </form>}
  </div>;
}
