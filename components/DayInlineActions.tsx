"use client";
import { useState } from "react";
import { ArrowUp, ArrowDown, CornerUpLeft, FolderInput, Pencil, Link2, Unlink, X } from "lucide-react";

type Props = { title: string; first: boolean; last: boolean; onClose: () => void; onSave: (title: string) => void; onMove: (direction: "up" | "down") => void; supplementTo?: string; linkOptions?: { id: string; title: string }[]; onLink?: (id: string | null) => void; parentFolder?: { id: string; title: string }; destinations?: { id: string; title: string }[]; onTransfer?: (id: string) => void };
export default function DayInlineActions({ title, first, last, onClose, onSave, onMove, supplementTo, linkOptions = [], onLink, parentFolder, destinations = [], onTransfer }: Props) {
  const [editing, setEditing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [moving, setMoving] = useState(false);
  const [destination, setDestination] = useState("");
  const [target, setTarget] = useState(supplementTo ?? "");
  const [value, setValue] = useState(title);
  return <div aria-label={`${title} 관리 영역`} className="mb-2 rounded-xl border border-[#e7edf2] bg-[#f8fafc] p-2 text-[11px] text-[#687887]">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => { setEditing(true); setLinking(false); setMoving(false); }} className="flex min-h-10 items-center gap-1 px-1"><Pencil size={13} />수정</button>
      <button type="button" disabled={first} onClick={() => onMove("up")} className="flex min-h-8 items-center gap-1 px-1 disabled:opacity-30"><ArrowUp size={13} />위로</button>
      <button type="button" disabled={last} onClick={() => onMove("down")} className="flex min-h-8 items-center gap-1 px-1 disabled:opacity-30"><ArrowDown size={13} />아래로</button>
      {onTransfer && parentFolder && <button type="button" onClick={() => onTransfer(parentFolder.id)} title={parentFolder.title} className="flex min-h-10 items-center gap-1 px-1"><CornerUpLeft size={13} />상위 목차로 이동</button>}
      {onTransfer && <button type="button" onClick={() => { setMoving(!moving); setEditing(false); setLinking(false); }} aria-expanded={moving} className="flex min-h-10 items-center gap-1 px-1"><FolderInput size={13} />다른 목차로 이동</button>}
      {onLink && <button type="button" onClick={() => { setLinking(!linking); setEditing(false); setMoving(false); }} aria-expanded={linking} className="flex min-h-10 items-center gap-1 px-1"><Link2 size={13} />{supplementTo ? "연결 변경" : "보충 Day로 연결"}</button>}
      {onLink && supplementTo && <button type="button" onClick={() => onLink(null)} className="flex min-h-10 items-center gap-1 px-1"><Unlink size={13} />연결 해제</button>}
      <button type="button" aria-label="Day 관리 닫기" onClick={onClose} className="ml-auto flex h-8 w-8 items-center justify-center"><X size={14} /></button>
    </div>
    {editing && <form className="mt-1 flex gap-2" onSubmit={event => { event.preventDefault(); if (value.trim()) onSave(value.trim()); }}>
      <input autoFocus aria-label="Day 이름" value={value} onChange={event => setValue(event.target.value)} className="h-8 min-w-0 flex-1 rounded-lg border border-[#e1e9ef] bg-white px-2 text-[12px] outline-none focus:border-[#9bbbd2]" />
      <button disabled={!value.trim()} className="rounded-lg bg-[#e2eff8] px-3 text-[#527895] disabled:opacity-40">저장</button>
    </form>}
    {moving && onTransfer && (destinations.length ? <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={event => { event.preventDefault(); if (destinations.some(option => option.id === destination)) onTransfer(destination); }}>
      <label className="w-full" htmlFor="day-destination">이동할 목차</label>
      <div className="relative min-w-0 flex-1">
      <select id="day-destination" autoFocus value={destination} onChange={event => setDestination(event.target.value)} className="h-8 w-full appearance-none rounded-lg border border-[#e1e9ef] bg-white pl-2.5 pr-8 text-[12px]">
        <option value="">목차 선택</option>
        {destinations.map(option => <option key={option.id} value={option.id}>{option.title}</option>)}
      </select>
      <span aria-hidden="true" className="folder-symbol pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[14px]">▽</span>
      </div>
      <button disabled={!destinations.some(option => option.id === destination)} className="h-8 shrink-0 rounded-lg bg-[#e2eff8] px-3 text-[#527895] disabled:opacity-40">여기로 이동</button>
      {destination && <p className="w-full break-words text-[11px] text-[#687887]">{destinations.find(option => option.id === destination)?.title}</p>}
    </form> : <p role="status" className="py-2">이동할 다른 목차가 없어요.</p>)}
    {linking && onLink && (linkOptions.length ? <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={event => { event.preventDefault(); if (linkOptions.some(option => option.id === target)) onLink(target); }}>
      <label className="w-full" htmlFor="supplement-day-target">연결할 Day</label>
      <div className="relative min-w-0 flex-1">
      <select id="supplement-day-target" autoFocus value={target} onChange={event => setTarget(event.target.value)} className="h-8 w-full appearance-none rounded-lg border border-[#e1e9ef] bg-white pl-2.5 pr-8 text-[12px]">
        <option value="">Day 선택</option>
        {linkOptions.map(option => <option key={option.id} value={option.id}>{option.title}</option>)}
      </select>
      <span aria-hidden="true" className="folder-symbol pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[14px]">▽</span>
      </div>
      <button disabled={!linkOptions.some(option => option.id === target)} className="h-8 shrink-0 rounded-lg bg-[#e2eff8] px-3 text-[#527895] disabled:opacity-40">연결</button>
    </form> : <p role="status" className="py-2">연결 가능한 Day가 없어요. 같은 목차의 일반 Day에 연결할 수 있으며, 보충 Day가 있는 항목은 연결할 수 없어요.</p>)}
  </div>;
}
