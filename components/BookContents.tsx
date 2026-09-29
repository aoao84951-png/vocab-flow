"use client";

import DayInlineActions from "./DayInlineActions";
import styles from "./BookContents.module.css";
import ContentsAddForm from "./ContentsAddForm";
import NoCover from "./NoCover";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CornerDownRight, FolderPlus, MoreHorizontal, Plus } from "lucide-react";
import FolderInlineActions from "./FolderInlineActions";
import type { FolderAction } from "@/lib/folderActions";
import { getContentsEntry, getFocusedContents, isBookFolder, resolveContentsPath, toggleContentsChapter, type ContentsDay, type ContentsFolder } from "@/lib/bookContents";
import { groupDays, supplementCandidates } from "@/lib/dayLinks";
import type useFolderDrag from "./useFolderDrag";

type Props = {
  books: ContentsFolder[];
  initialPath: string[];
  selectedDayId: string;
  onNavigate: (path: string[], dayId: string) => void;
  onFolderAction: (action: FolderAction) => void;
  drag: ReturnType<typeof useFolderDrag>;
  onPageChange: () => void;
  onLocationChange: (path: string[]) => void;
};

export default function BookContents({ books, initialPath, selectedDayId, onNavigate, onFolderAction, drag, onPageChange, onLocationChange }: Props) {
  const [requestedPath, setRequestedPath] = useState(() => getContentsEntry(books, initialPath).path);
  const [open, setOpen] = useState<Record<string, string>>(() => {
    let saved: Record<string, string> = {};
    try {
      const value = JSON.parse(sessionStorage.getItem("vocab-contents-selection") ?? "{}");
      if (value && typeof value === "object") saved = Object.fromEntries(Object.entries(value).filter(([, id]) => typeof id === "string")) as Record<string, string>;
    } catch { /* The contents also work when storage is unavailable. */ }
    return { ...saved, ...getContentsEntry(books, initialPath, selectedDayId).open };
  });
  const [adding, setAdding] = useState<{ kind: "folder" | "day"; path: string[] } | null>(null);
  const onAdd = (kind: "folder" | "day", target: string[]) => { setManaging(null); setAdding({ kind, path: target }); };
  const [managing, setManaging] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const chain = resolveContentsPath(books, requestedPath);
  const path = chain.map(folder => folder.id);
  const current = chain.at(-1);
  const parent = chain.at(-2);
  const insideBook = chain.some(isBookFolder);
  const focused = current && insideBook ? getFocusedContents(current, open) : undefined;
  const activePath = focused ? [...path, ...focused.folders.slice(1).map(folder => folder.id)] : path;
  const destinations: { id: string; title: string; path: string[] }[] = [];
  const collectDestinations = (folders: ContentsFolder[], base: string[] = [], titles: string[] = []) => folders.forEach(folder => {
    const nextPath = [...base, folder.id], nextTitles = [...titles, folder.title];
    destinations.push({ id: folder.id, title: nextTitles.join(" / "), path: nextPath });
    collectDestinations(folder.folders, nextPath, nextTitles);
  });
  collectDestinations(books);
  const transferDay = (folder: ContentsFolder, day: ContentsDay, destination: string) => {
    const target = destinations.find(option => option.id === destination);
    if (!target || target.id === folder.id) return;
    onFolderAction({ kind: "transfer-day", id: folder.id, dayId: day.id, destination });
    setManaging(null); setAdding(null);
    // Keep the underlying study location valid when its Day changes folders.
    if (day.id === selectedDayId) { onNavigate(target.path, day.id); return; }
    const entry = getContentsEntry(books, target.path);
    setRequestedPath(resolveContentsPath(books, target.path).some(isBookFolder) ? entry.path : target.path);
    setOpen(previous => ({ ...previous, ...entry.open, [target.id]: target.id }));
    onPageChange();
  };
  const locationKey = JSON.stringify(activePath);
  useEffect(() => { onLocationChange(JSON.parse(locationKey)); }, [locationKey, onLocationChange]);
  useEffect(() => {
    try { sessionStorage.setItem("vocab-contents-selection", JSON.stringify(open)); } catch { /* Optional navigation memory. */ }
  }, [open]);

  const enter = (next: string[]) => {
    setRequestedPath(next); setAdding(null); setManaging(null); onPageChange();
    requestAnimationFrame(() => headingRef.current?.focus());
  };
  const menu = (folder: ContentsFolder, compact = false) => <button type="button" aria-label={`${folder.title} 관리`} aria-expanded={managing === folder.id} onClick={() => setManaging(managing === folder.id ? null : folder.id)} className={`flex ${compact ? "h-8 [@media(pointer:coarse)]:h-10" : "h-10"} w-8 shrink-0 items-center justify-center rounded-lg text-[#8b9cac] hover:bg-[#eff7fc]`}><MoreHorizontal size={16} strokeWidth={1.7} /></button>;
  const actions = (folder: ContentsFolder, location: string[]) => managing === folder.id && <FolderInlineActions key={folder.id} folder={folder} books={books} onAction={onFolderAction} onAddDay={() => onAdd("day", location)} onClose={() => setManaging(null)} />;
  const rowProps = (folder: ContentsFolder, location: string[]) => ({
    "data-folder-row": folder.id,
    "data-folder-title": folder.title,
    "data-folder-path": JSON.stringify(location),
  });
  const dropClass = (id: string) => drag?.drop?.id === id
    ? drag.drop.position === "inside" ? "rounded-lg bg-[#eff7fc] ring-2 ring-[#a5c7df]" : drag.drop.position === "before" ? "border-t-2 border-t-[#87b5d4]" : "border-b-2 border-b-[#87b5d4]"
    : "";
  const grabStyle = { WebkitTouchCallout: "none" as const, userSelect: "none" as const, cursor: drag ? "grabbing" : "grab" };
  const days = (folder: ContentsFolder, location: string[], inset = 0) => {
    const groups = groupDays(folder.days);
    const row = (day: ContentsDay, siblings: ContentsDay[], supplement = false, hasSupplements = false) => {
      const index = siblings.findIndex(item => item.id === day.id);
      const rowSpacing = supplement ? "min-h-6 py-0.5 [@media(pointer:coarse)]:min-h-7"
        : hasSupplements ? "min-h-7 py-1 [@media(pointer:coarse)]:min-h-8"
        : "min-h-8 py-1.5 [@media(pointer:coarse)]:min-h-10";
      const menuHeight = supplement ? "h-6 [@media(pointer:coarse)]:h-7"
        : hasSupplements ? "h-7 [@media(pointer:coarse)]:h-8"
        : "h-8 [@media(pointer:coarse)]:h-10";
      return <div key={day.id}>
        <div data-folder-row={day.id} data-folder-kind="day" data-folder-title={day.title} data-folder-path={JSON.stringify(location)} data-supplement-to={supplement ? day.supplementTo : undefined} className={`group flex items-center rounded-lg ${day.id === selectedDayId ? "bg-[#eff7fc]" : "hover:bg-[#f5f9fc]"} ${dropClass(day.id)} ${drag?.id === day.id ? "opacity-40" : ""}`}>
          <button type="button" data-folder-grab style={{ ...grabStyle, paddingLeft: inset + (supplement ? 22 : 10) }} onClick={() => onNavigate(location, day.id)} aria-current={day.id === selectedDayId ? "page" : undefined} className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg pr-2 text-left ${rowSpacing}`}>
            {supplement && <CornerDownRight aria-label="보충 Day" size={14} className="shrink-0 text-[#8b9aa7]" />}
            <span className={`min-w-0 break-words leading-snug ${supplement ? "text-[12px] text-[#788b9a]" : "text-[13px] text-[#505660]"}`}>{day.title}</span>
            <span className="shrink-0 text-[11px] tabular-nums text-[#8b9aa7]">{day.words.length}개</span>
          </button>
          <button type="button" aria-label={`${day.title} 관리`} aria-expanded={managing === day.id} onClick={() => setManaging(managing === day.id ? null : day.id)} className={`flex ${menuHeight} w-8 shrink-0 items-center justify-center rounded-lg text-[#8b9cac] [@media(pointer:coarse)]:w-10 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 ${managing === day.id ? "!opacity-100" : ""}`}><MoreHorizontal size={16} strokeWidth={1.7} /></button>
        </div>
        {managing === day.id && <DayInlineActions key={day.id} title={day.title}
          parentFolder={destinations.find(option => option.id === location.at(-2))}
          destinations={destinations.filter(option => option.id !== folder.id)}
          onTransfer={destination => transferDay(folder, day, destination)}
          supplementTo={day.supplementTo} linkOptions={supplementCandidates(folder.days, day.id)} onLink={supplementTo => { onFolderAction({ kind: "link-day", id: folder.id, dayId: day.id, supplementTo }); setManaging(null); }} onClose={() => setManaging(null)} onSave={title => { onFolderAction({ kind: "edit-day", id: folder.id, dayId: day.id, title }); setManaging(null); }} onMove={direction => { const target = siblings[index + (direction === "up" ? -1 : 1)]; if (target) onFolderAction({ kind: "move-day", id: folder.id, dayId: day.id, relativeTo: target.id, placement: direction === "up" ? "before" : "after" }); }} first={index === 0} last={index === siblings.length - 1} />}
      </div>;
    };
    return groups.map(group => <div key={group.day.id} className="border-b border-[#edf2f6] py-1 last:border-b-0">
      {row(group.day, groups.map(item => item.day), false, group.supplements.length > 0)}
      {group.supplements.map(day => row(day, group.supplements, true))}
    </div>);
  };

  const chapters = (folders: ContentsFolder[], base: string[], depth = 0) => folders.map((folder, index) => {
    const location = [...base, folder.id];
    const parentId = base.at(-1)!;
    const expanded = open[parentId] === folder.id;
    // Book identity is independent of its cover. Chapters inside a book stay inline.
    const pageLink = !insideBook && isBookFolder(folder);
    const toggle = () => {
      setManaging(null);
      if (pageLink) enter(location);
      else setOpen(prev => toggleContentsChapter(prev, parentId, folder.id));
    };
    return <section key={folder.id} className={`${depth === 0 ? (index < folders.length - 1 ? "border-b border-[#edf2f6] py-1" : "py-1") : ""} ${drag?.id === folder.id ? "opacity-40" : ""}`}>
      <div {...rowProps(folder, location)} className={`flex items-center ${dropClass(folder.id)}`}>
        <button type="button" data-folder-grab style={grabStyle} onClick={toggle} aria-expanded={pageLink ? undefined : expanded} className="flex min-h-10 min-w-0 flex-1 items-center gap-2 py-1.5 text-left">
          {!folder.coverImage && isBookFolder(folder) && <NoCover />}
          {folder.coverImage && <Image unoptimized width={36} height={52} src={folder.coverImage} alt="" className="h-[52px] w-9 shrink-0 rounded object-contain" />}
          {!isBookFolder(folder) && !folder.coverImage && <span className={`shrink-0 text-[10px] ${insideBook && depth === 0 ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#eaf5fc] text-[#688aa3]" : "w-4 text-[#8ba0b0]"}`}>{String(index + 1).padStart(2, "0")}</span>}
          <span className="min-w-0 flex-1 break-words text-[14px] leading-snug text-[#505660]">{folder.title}</span>
          <span aria-label={`하위 목차 ${folder.folders.length}개, Day ${folder.days.length}개`} className="shrink-0 self-center text-[10px] text-[#8b9aa7]">{folder.folders.length + folder.days.length}</span>
        </button>
        {menu(folder)}
      </div>
      {actions(folder, location)}
      {expanded && !pageLink && <div className={depth < 2 ? "ml-1.5 border-l border-[#edf2f6] pl-2" : "border-l border-[#edf2f6] pl-0"}>
        {folder.desc && <p className="mb-2 whitespace-pre-wrap break-words text-sm text-[#8995a0]">{folder.desc}</p>}
        {chapters(folder.folders, location, depth + 1)}
        {days(folder, location, insideBook && depth === 0 ? 13 : depth < 2 ? 9 : 23)}
        {!folder.folders.length && !folder.days.length && <p className="py-3 text-sm text-[#8b9aa7]">아직 목차나 Day가 없어요.</p>}
      </div>}
    </section>;
  });

  const addForm = adding && <ContentsAddForm key={JSON.stringify(adding)} kind={adding.kind} root={!adding.path.length} parentTitle={resolveContentsPath(books, adding.path).at(-1)?.title} onCancel={() => setAdding(null)} onSubmit={values => {
    onFolderAction(adding.kind === "day" ? { kind: "add-day", id: adding.path.at(-1)!, title: values.title } : { kind: "add", id: adding.path.at(-1) ?? "", icon: "", ...values });
    setOpen(previous => { const next = { ...previous }; for (let i = 0; i < adding.path.length - 1; i++) next[adding.path[i]] = adding.path[i + 1]; return next; });
    setAdding(null);
  }} />;

  if (!current) return <div className={styles.contents}>
    <h3 ref={headingRef} tabIndex={-1} className="sr-only">나의 단어장</h3>
    <p className="mb-1 text-[11px] text-[#8b9aa7]">{books.length}개 단어장</p>
    {books.map((folder, index) => <div key={folder.id} className={`${index < books.length - 1 ? "border-b border-[#edf2f6]" : ""} py-1 ${drag?.id === folder.id ? "opacity-40" : ""}`}>
      <div {...rowProps(folder, [folder.id])} className={`flex items-center ${dropClass(folder.id)}`}>
        <button type="button" data-folder-grab style={grabStyle} onClick={() => enter([folder.id])} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-2 text-left">
          {!folder.coverImage && isBookFolder(folder) && <NoCover />}
          {folder.coverImage && <Image unoptimized width={36} height={52} src={folder.coverImage} alt="" className="h-[52px] w-9 shrink-0 rounded object-contain" />}
          <span className="min-w-0 flex-1"><span className="block break-words text-[14px] leading-snug text-[#505660]">{folder.title}</span>
            {folder.desc && <span className="mt-1 block line-clamp-2 text-xs text-[#8995a0]">{folder.desc}</span>}
            <span className="mt-1 block text-[10px] text-[#8b9aa7]">{folder.folders.length}개 목차{folder.days.length ? ` · ${folder.days.length}개 Day` : ""}</span>
          </span>
        </button>{menu(folder)}
      </div>{actions(folder, [folder.id])}
    </div>)}
    {!books.length && <p className="py-8 text-sm text-[#8b9aa7]">첫 단어장을 만들어보세요. 표지는 나중에 넣어도 괜찮아요.</p>}
    {addForm}
    <div className="mt-3 flex justify-center"><button type="button" onClick={() => onAdd("folder", [])} className="min-h-10 rounded-xl bg-[#f5f9fc] px-6 text-xs text-[#68869e]">단어장 추가</button></div>
  </div>;

  return <div className={styles.contents}>
    <div className="mb-1 flex flex-wrap items-center justify-between gap-x-4">
      <button type="button" onClick={() => enter(path.slice(0, -1))} className="flex min-h-9 min-w-0 items-center gap-1 text-[11px] text-[#8196a7]"><span aria-hidden="true" className="folder-symbol inline-flex w-3 shrink-0 justify-start text-[13px]">◁</span><span className="min-w-0 break-words">{parent ? parent.title : "단어장 목록"}</span></button>
      {parent && <button type="button" onClick={() => enter([])} className="min-h-9 text-[11px] text-[#8b9aa7]">전체 단어장</button>}
    </div>
    <div className="mb-2 flex items-center gap-2">
      {current.coverImage && <Image unoptimized width={36} height={52} src={current.coverImage} alt="" className="h-[52px] w-9 shrink-0 rounded object-contain" />}
      <h3 ref={headingRef} tabIndex={-1} className="min-w-0 flex-1 break-words text-[17px] leading-snug text-[#505660] outline-none">{current.title}</h3>
      {menu(current)}
    </div>
    {current.desc && <p className="mb-2 whitespace-pre-wrap break-words text-xs text-[#8995a0]">{current.desc}</p>}
    {actions(current, path)}
    {focused ? <div className="mt-2">
      {focused.levels.map(({ folder, selectedId }, depth) => {
        const base = [...path, ...focused.folders.slice(1, depth + 1).map(item => item.id)];
        const selected = folder.folders.find(item => item.id === selectedId);
        return <div key={folder.id} className={depth === 0 ? "mb-1.5" : "mb-1"}>
          <div role="group" aria-label={`${folder.title} 하위 목차`} className={`flex flex-wrap items-center gap-x-1 gap-y-1 ${depth === 0 ? "border-b border-[#e7edf2]" : ""}`}>
            {folder.days.length > 0 && <button type="button" aria-pressed={selectedId === folder.id} onClick={() => { setOpen(prev => ({ ...prev, [folder.id]: folder.id })); setManaging(null); setAdding(null); }} className="min-h-8 text-xs [@media(pointer:coarse)]:min-h-10"><span className={`block rounded-md px-2.5 py-1 ${selectedId === folder.id ? "bg-[#eff7fc] text-[#527895]" : "text-[#8b9aa7]"}`}>직접 등록한 Day</span></button>}
            {folder.folders.map(child => <div key={child.id} {...rowProps(child, [...base, child.id])} className={`min-w-0 max-w-full ${dropClass(child.id)} ${drag?.id === child.id ? "opacity-40" : ""}`}>
              <button type="button" data-folder-grab style={grabStyle} aria-pressed={selectedId === child.id} onClick={() => { setOpen(prev => ({ ...prev, [folder.id]: child.id })); setManaging(null); setAdding(null); }} className={`min-h-8 max-w-full break-words text-left [@media(pointer:coarse)]:min-h-10 ${depth === 0 ? `border-b-2 px-2.5 text-[13px] ${selectedId === child.id ? "border-[#688aa3] text-[#527895]" : "border-transparent text-[#8b9aa7]"}` : "text-[12px]"}`}><span className={depth === 0 ? undefined : `block rounded-md px-2.5 py-1 ${selectedId === child.id ? "bg-[#eff7fc] text-[#527895]" : "text-[#8b9aa7] hover:bg-[#f5f9fc]"}`}>{child.title}</span></button>
            </div>)}
            {selected && <div className="ml-auto">{menu(selected, true)}</div>}
          </div>
          {selected && actions(selected, [...base, selected.id])}
        </div>;
      })}
      <div className={focused.current.days.length ? undefined : "min-h-[156px]"}>
        {focused.current !== current && focused.current.desc && <p className="mb-2 whitespace-pre-wrap break-words text-xs text-[#8995a0]">{focused.current.desc}</p>}
        {days(focused.current, activePath)}
        {!focused.current.days.length && <p className="py-8 text-center text-sm text-[#8b9aa7]">아직 등록된 Day가 없어요.</p>}
      </div>
    </div> : <>
      <div>{chapters(current.folders, path)}{days(current, path)}</div>
      {!current.folders.length && !current.days.length && <p className="py-8 text-sm text-[#8b9aa7]">이곳에 하위 목차나 Day를 추가해보세요.</p>}
    </>}
    {addForm}
    <div className="flex items-center justify-center gap-2 border-t border-[#edf2f6] pt-2">
      <button type="button" onClick={() => onAdd("day", activePath)} className="flex min-h-9 flex-1 max-w-36 items-center justify-center gap-1.5 rounded-lg bg-[#f5f9fc] px-3 text-xs text-[#68869e] [@media(pointer:coarse)]:min-h-10"><Plus size={14} />Day 추가</button>
      <button type="button" onClick={() => onAdd("folder", activePath)} className="flex min-h-9 flex-1 max-w-36 items-center justify-center gap-1.5 rounded-lg bg-[#f5f9fc] px-3 text-xs text-[#68869e] [@media(pointer:coarse)]:min-h-10"><FolderPlus size={14} />하위 목차 추가</button>
    </div>
  </div>;
}
