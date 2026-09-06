"use client";

import { Search, X } from "lucide-react";

export default function WordSearch({ query, onChange, total, shown }: {
  query: string; onChange: (query: string) => void; total: number; shown: number;
}) {
  return <div className="mt-5 space-y-2">
    <div className="flex items-center gap-2 rounded-xl bg-[#f5f8fa] px-3 text-[#8a94a6] focus-within:ring-1 focus-within:ring-[#c4dfef]">
      <Search size={17} aria-hidden="true" />
      <input type="search" aria-label="단어 또는 뜻 검색" placeholder="단어 또는 뜻 검색" value={query} onChange={event => onChange(event.target.value)} className="h-11 min-w-0 flex-1 bg-transparent text-base text-[#303236] outline-none placeholder:text-[#969da7] [&::-webkit-search-cancel-button]:appearance-none" />
      {query && <button aria-label="검색 지우기" onClick={() => onChange("")} className="flex h-9 w-9 items-center justify-center"><X size={16} /></button>}
    </div>
    <p role="status" className="text-xs text-[#858b94]">총 {total}개{query.trim() || shown !== total ? ` · ${shown}개 표시` : ""}</p>
  </div>;
}
