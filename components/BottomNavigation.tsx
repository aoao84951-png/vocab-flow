"use client";
import { useEffect, useMemo, useState } from "react";
import { Home, Search, X } from "lucide-react";
import { RichText } from "./RichTextField";
import { matchesWordSearch } from "@/lib/wordSearch";
import useModalScrollLock from "./useModalScrollLock";

type Word = { id: string; word: string; meanings?: { items: string[] }[]; importanceStars?: number };
type Day = { id: string; title: string; words: Word[] };
type Folder = { id: string; title: string; icon?: string; folders: Folder[]; days: Day[] };
type Props = { books: Folder[]; step: string; path: string[]; dayId: string; onHome: () => void; onNavigate: (path: string[], dayId?: string, wordIndex?: number) => void; onAdd: (kind: "folder" | "day" | "word", dayId?: string) => void };
export default function BottomNavigation({ books, step, path, dayId, onHome, onNavigate, onAdd }: Props) {
  const [panel, setPanel] = useState<"search" | "stars" | "add" | "contents" | null>(null);
  const [query, setQuery] = useState("");
  const [stars, setStars] = useState(0);
  const [pickingDay, setPickingDay] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const visible = ["book", "day", "wordList", "study"].includes(step);
  useModalScrollLock(visible && panel !== null);
  useEffect(() => { setPanel(null); setPickingDay(false); }, [step, path, dayId]);
  useEffect(() => { const close = () => setPanel(null); window.addEventListener("popstate", close); return () => window.removeEventListener("popstate", close); }, []);
  useEffect(() => { if (!panel) return; const key = (e: KeyboardEvent) => { if (e.key === "Escape") setPanel(null); }; document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key); }, [panel]);
  const entries = useMemo(() => {
    const list: { word: Word; index: number; path: string[]; day: Day; location: string }[] = [];
    const walk = (folders: Folder[], parent: string[], names: string[]) => folders.forEach(folder => {
      const next = [...parent, folder.id], titles = [...names, folder.title];
      folder.days.forEach(day => day.words.forEach((word, index) => list.push({ word, index, path: next, day, location: [...titles, day.title].join(" › ") })));
      walk(folder.folders, next, titles);
    }); walk(books, [], []); return list;
  }, [books]);
  let current: Folder | undefined; let folders = books;
  for (const id of path) { current = folders.find(folder => folder.id === id); folders = current?.folders ?? []; }
  const results = entries.filter(entry => matchesWordSearch(entry.word, query) && (panel !== "stars" || (entry.word.importanceStars ?? 0) > 0 && (!stars || entry.word.importanceStars === stars)));
  const open = (value: typeof panel) => { setPanel(panel === value ? null : value); setQuery(""); setPickingDay(false); if (value === "contents") setExpanded(path); };
  const navigate = (target: string[], day?: string, index?: number) => { setPanel(null); onNavigate(target, day, index); };
  const add = (kind: "folder" | "day" | "word", day?: string) => { setPanel(null); onAdd(kind, day); };
  const tree = (items: Folder[], parent: string[] = []) => items.map(folder => {
    const next = [...parent, folder.id], isOpen = expanded.includes(folder.id), hasChildren = folder.folders.length + folder.days.length > 0;
    return <div key={folder.id}><div className="flex min-h-11 items-center gap-2">
      <button className="min-w-0 flex-1 truncate py-2 text-left text-sm text-[#4b5058]" onClick={() => navigate(next)}>{folder.icon && <span className="folder-symbol mr-2 text-lg">{folder.icon}</span>}{folder.title}</button>
      {hasChildren && <button aria-label={`${folder.title} ${isOpen ? "접기" : "펼치기"}`} aria-expanded={isOpen} onClick={() => setExpanded(prev => isOpen ? prev.filter(id => id !== folder.id) : [...prev, folder.id])} className="folder-symbol h-10 w-10 text-sm">{isOpen ? "△" : "▽"}</button>}
    </div>{isOpen && <div className="ml-3 border-l border-[#e7edf2] pl-4">{tree(folder.folders, next)}{folder.days.map(day => <button key={day.id} onClick={() => navigate(next, day.id)} className={`block min-h-10 w-full rounded-lg px-2 text-left text-sm ${day.id === dayId ? "bg-[#eff7fc]" : ""}`}>{day.title}<span className="ml-2 text-xs text-[#939ba5]">{day.words.length}개</span></button>)}</div>}</div>;
  });
  if (!visible) return null;
  return <>
    {panel && <div className="fixed inset-0 z-[70] bg-black/15" onClick={() => setPanel(null)}>
      <section role="dialog" aria-modal="true" aria-label={{search:"전체 검색",stars:"중요 단어",add:"추가",contents:"목차"}[panel]} onClick={e => e.stopPropagation()} className="absolute inset-x-3 bottom-[calc(98px+env(safe-area-inset-bottom))] mx-auto flex max-h-[calc(100dvh-140px-env(safe-area-inset-bottom)-env(safe-area-inset-top))] max-w-[640px] flex-col rounded-3xl bg-white px-5 pt-5 pb-4 shadow-xl sm:inset-x-0 sm:bottom-[108px] sm:max-h-[72dvh]">
        <div className="mb-4 flex shrink-0 items-center justify-between"><h2 className="text-lg font-bold">{{search:"전체 검색",stars:"중요 단어",add:`${current?.days.find(day => day.id === dayId)?.title || current?.title || "단어장"}에 추가`,contents:"목차"}[panel]}</h2><div className="flex items-center gap-2"><button autoFocus aria-label="닫기" onClick={() => setPanel(null)} className="flex h-10 w-10 items-center justify-center"><X size={19}/></button></div></div>
        <div data-bottom-panel-scroll className="min-h-0 overflow-y-auto overscroll-contain">
          {(panel === "search" || panel === "stars") && <><input aria-label="전체 단어 검색" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="모든 단어와 뜻 검색" className="mb-3 h-11 w-full rounded-xl bg-[#f5f8fa] px-3 text-base outline-none"/>{panel === "stars" && <div className="mb-3 flex gap-2">{[0,1,2,3].map(value => <button key={value} aria-pressed={stars === value} className={`rounded-full px-3 py-2 text-xs ${stars === value ? "bg-[#dceefa]" : "bg-[#f5f8fa]"}`} onClick={() => setStars(value)}>{value ? `${value}단계` : "전체"}</button>)}</div>}<p className="mb-2 text-xs text-[#858b94]">{results.length}개</p>{results.length ? results.map(entry => <button key={`${entry.day.id}-${entry.word.id}-${entry.index}`} onClick={() => navigate(entry.path, entry.day.id, entry.index)} className="block w-full border-b border-[#edf1f4] py-3 text-left"><span className="font-semibold"><RichText text={entry.word.word} /></span><span className="ml-2 folder-symbol text-sm">{"☆".repeat(Math.min(3, Math.max(0, entry.word.importanceStars ?? 0)))}</span><span className="mt-1 block truncate text-xs text-[#858b94]">{entry.location}</span><span className="mt-1 block line-clamp-2 text-sm text-[#666d77]"><RichText text={entry.word.meanings?.flatMap(group => group.items).join(", ") || ""} /></span></button>) : <p className="py-8 text-center text-sm text-[#858b94]">{panel === "stars" ? "조건에 맞는 중요 단어가 없어요." : "검색 결과가 없어요."}</p>}</>}
          {panel === "contents" && (books.length ? tree(books) : <p className="py-6 text-sm text-[#858b94]">아직 폴더가 없어요. ＋로 추가해 주세요.</p>)}
          {panel === "add" && <div className="space-y-2">{pickingDay ? <><p className="mb-3 text-sm text-[#858b94]">단어를 저장할 Day를 선택하세요.</p>{current?.days.map(day => <button key={day.id} className="block w-full rounded-xl bg-[#f5f8fa] px-4 py-3 text-left" onClick={() => add("word", day.id)}>{day.title}</button>)}</> : <>{current && <button className="block w-full rounded-xl bg-[#eff7fc] px-4 py-3 text-left" onClick={() => { if (dayId) add("word", dayId); else if (current.days.length) setPickingDay(true); else add("day"); }}>{current.days.length || dayId ? "단어 추가" : "Day 먼저 만들기"}</button>}{!dayId && <>{current && current.days.length > 0 && <button className="block w-full rounded-xl bg-[#f5f8fa] px-4 py-3 text-left" onClick={() => add("day")}>Day 추가</button>}<button className="block w-full rounded-xl bg-[#f5f8fa] px-4 py-3 text-left" onClick={() => add("folder")}>폴더 추가</button></>}</>}</div>}
        </div>
      </section>
    </div>}
    <nav aria-label="주요 메뉴" className="fixed inset-x-0 bottom-0 z-[80] border-t border-[#edf1f4] bg-white/95 px-4 pt-2 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-xl sm:inset-x-auto sm:left-1/2 sm:bottom-5 sm:w-[460px] sm:-translate-x-1/2 sm:rounded-full sm:border sm:pb-3 sm:shadow-[0_6px_30px_rgba(40,60,80,0.10)]">
      <div className="mx-auto grid max-w-[460px] grid-cols-5 items-center">
        <button aria-label="홈" aria-current={!panel && step === "book" ? "page" : undefined} onClick={() => { setPanel(null); onHome(); }} className="flex h-12 items-center justify-center text-[#858b94]"><Home size={23} strokeWidth={1.7}/></button>
        <button aria-label="전체 검색" aria-expanded={panel === "search"} onClick={() => open("search")} className="flex h-12 items-center justify-center text-[#858b94]"><Search size={23} strokeWidth={1.7}/></button>
        <button aria-label="추가" aria-expanded={panel === "add"} onClick={() => open("add")} className="folder-symbol mx-auto -mt-6 flex h-14 w-14 items-center justify-center rounded-[22px] bg-[#dceefa] text-[32px] text-[#587fa3] shadow-[0_5px_18px_rgba(145,186,214,0.15)]">+</button>
        <button aria-label="중요 단어" aria-expanded={panel === "stars"} onClick={() => open("stars")} className="folder-symbol flex h-12 items-center justify-center text-[27px] text-[#858b94]">☆</button>
        <button aria-label="목차" aria-expanded={panel === "contents"} onClick={() => open("contents")} className="flex h-12 items-center justify-center text-[#858b94]"><span className="folder-symbol text-[27px]">≡</span></button>
      </div>
    </nav>
  </>;
}
