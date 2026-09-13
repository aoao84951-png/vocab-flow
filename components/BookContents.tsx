"use client";

import ContentsAddForm from "./ContentsAddForm";
import NoCover from "./NoCover";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import FolderInlineActions from "./FolderInlineActions";
import type { FolderAction } from "@/lib/folderActions";
import { getContentsEntry, isBookFolder, resolveContentsPath, toggleContentsChapter, type ContentsFolder } from "@/lib/bookContents";
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
  const [open, setOpen] = useState<Record<string, string>>(() => getContentsEntry(books, initialPath).open);
  const [adding, setAdding] = useState<{ kind: "folder" | "day"; path: string[] } | null>(null);
  const onAdd = (kind: "folder" | "day", target: string[]) => { setManaging(null); setAdding({ kind, path: target }); };
  const [managing, setManaging] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const chain = resolveContentsPath(books, requestedPath);
  const path = chain.map(folder => folder.id);
  const locationKey = JSON.stringify(path);
  useEffect(() => { onLocationChange(JSON.parse(locationKey)); }, [locationKey, onLocationChange]);
  const current = chain.at(-1);
  const parent = chain.at(-2);
  const insideBook = chain.some(isBookFolder);

  const enter = (next: string[]) => {
    setRequestedPath(next); setAdding(null); setManaging(null); setOpen({}); onPageChange();
    requestAnimationFrame(() => headingRef.current?.focus());
  };
  const menu = (folder: ContentsFolder) => <button type="button" aria-label={`${folder.title} 관리`} aria-expanded={managing === folder.id} onClick={() => setManaging(managing === folder.id ? null : folder.id)} className="flex h-10 w-8 shrink-0 items-center justify-center rounded-full text-[#8b9cac] hover:bg-[#eff7fc]"><MoreHorizontal size={16} strokeWidth={1.7} /></button>;
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
  const days = (folder: ContentsFolder, location: string[]) => folder.days.map(day => <button type="button" key={day.id} onClick={() => onNavigate(location, day.id)} aria-current={day.id === selectedDayId ? "page" : undefined} className={`flex min-h-10 w-full items-baseline gap-2 rounded-lg px-1 py-2 text-left hover:bg-[#f5f9fc] ${day.id === selectedDayId ? "bg-[#eff7fc]" : ""}`}>
    <span className="min-w-0 break-words text-[13px] text-[#505660]">{day.title}</span><span aria-hidden="true" className="min-w-3 flex-1 border-b border-dotted border-[#dfe8ef]" /><span className="shrink-0 text-xs text-[#8b9aa7]">{day.words.length}개</span>
  </button>);

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
          {!isBookFolder(folder) && !folder.coverImage && <span className="w-4 shrink-0 text-[10px] text-[#8ba0b0]">{String(index + 1).padStart(2, "0")}</span>}
          <span className="min-w-0 flex-1 break-words text-[14px] leading-snug text-[#505660]">{folder.title}</span>
          <span aria-label={`하위 목차 ${folder.folders.length}개, Day ${folder.days.length}개`} className="shrink-0 self-center text-[10px] text-[#8b9aa7]">{folder.folders.length + folder.days.length}</span>
        </button>
        {menu(folder)}
      </div>
      {actions(folder, location)}
      {expanded && !pageLink && <div className={depth < 2 ? "ml-1.5 border-l border-[#edf2f6] pl-2" : "border-l border-[#edf2f6] pl-0"}>
        {folder.desc && <p className="mb-2 whitespace-pre-wrap break-words text-sm text-[#8995a0]">{folder.desc}</p>}
        {chapters(folder.folders, location, depth + 1)}
        {days(folder, location)}
        {!folder.folders.length && !folder.days.length && <p className="py-3 text-sm text-[#8b9aa7]">아직 목차나 Day가 없어요.</p>}
      </div>}
    </section>;
  });

  const addForm = adding && <ContentsAddForm key={JSON.stringify(adding)} kind={adding.kind} root={!adding.path.length} parentTitle={resolveContentsPath(books, adding.path).at(-1)?.title} onCancel={() => setAdding(null)} onSubmit={values => {
    onFolderAction(adding.kind === "day" ? { kind: "add-day", id: adding.path.at(-1)!, title: values.title } : { kind: "add", id: adding.path.at(-1) ?? "", icon: "", ...values });
    setOpen(previous => { const next = { ...previous }; for (let i = 0; i < adding.path.length - 1; i++) next[adding.path[i]] = adding.path[i + 1]; return next; });
    setAdding(null);
  }} />;

  if (!current) return <div>
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

  return <div>
    <div className="mb-1 flex flex-wrap items-center justify-between gap-x-4">
      <button type="button" onClick={() => enter(path.slice(0, -1))} className="flex min-h-9 min-w-0 items-center gap-1 text-[11px] text-[#8196a7]"><span aria-hidden="true" className="folder-symbol inline-flex w-3 shrink-0 justify-start text-[13px]">◁</span><span className="min-w-0 break-words">{parent ? parent.title : "단어장 목록"}</span></button>
      {parent && <button type="button" onClick={() => enter([])} className="min-h-9 text-[11px] text-[#8b9aa7]">전체 단어장</button>}
    </div>
    <div className="mb-2 flex items-center gap-2"><h3 ref={headingRef} tabIndex={-1} className="min-w-0 flex-1 break-words text-[17px] leading-snug text-[#505660] outline-none">{current.title}</h3>{menu(current)}</div>
    {current.desc && <p className="mb-2 whitespace-pre-wrap break-words text-xs text-[#8995a0]">{current.desc}</p>}
    {actions(current, path)}
    <div className="border-t border-[#e8eef3]">{chapters(current.folders, path)}{days(current, path)}</div>
    {!current.folders.length && !current.days.length && <p className="py-8 text-sm text-[#8b9aa7]">이곳에 하위 목차나 Day를 추가해보세요.</p>}
    {addForm}
    <div className="flex items-center justify-center gap-2 border-t border-[#edf2f6] pt-3">
      <button type="button" onClick={() => onAdd("day", path)} className="min-h-10 flex-1 max-w-40 rounded-xl bg-[#f5f9fc] px-3 text-xs text-[#68869e]">Day 추가</button>
      <button type="button" onClick={() => onAdd("folder", path)} className="min-h-10 flex-1 max-w-40 rounded-xl bg-[#f5f9fc] px-3 text-xs text-[#68869e]">하위 목차 추가</button>
    </div>
  </div>;
}
