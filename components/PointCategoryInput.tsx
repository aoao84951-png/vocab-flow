"use client";
import { useRef, useState } from "react";

export default function PointCategoryInput({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  const [custom, setCustom] = useState(!options.includes(value));
  const input = useRef<HTMLInputElement>(null);
  return <div className="relative w-[120px] shrink-0 sm:w-40">
    {custom && <input ref={input} autoFocus aria-label="포인트 분류 직접 입력" value={value} onChange={event => onChange(event.target.value)} placeholder="직접 입력" className="h-11 w-full rounded-xl border border-[#ddeaf3] bg-white px-3 pr-8 text-[13px] outline-none focus:border-[#91bad6]" />}
    <select aria-label="포인트 분류 선택" value={custom ? "직접입력" : value} onChange={event => {
      const next = event.target.value;
      setCustom(next === "직접입력");
      onChange(next === "직접입력" ? "" : next);
      if (next === "직접입력") requestAnimationFrame(() => input.current?.focus());
    }} className={custom ? "absolute right-0 top-0 h-11 w-8 cursor-pointer opacity-0" : "h-11 w-full appearance-none rounded-xl border border-[#ddeaf3] bg-white px-3 pr-8 text-[13px] outline-none"}>
      {options.map(option => <option key={option}>{option}</option>)}
      <option>직접입력</option>
    </select>
    <span aria-hidden="true" className="folder-symbol pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[14px]">▽</span>
  </div>;
}
