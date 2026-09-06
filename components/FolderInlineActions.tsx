"use client";
import { useState } from "react";
import { FolderPlus, Pencil, CornerUpRight, Trash2, X } from "lucide-react";
import { FolderSymbolPicker } from "./FolderSymbols";
import type { FolderAction } from "@/lib/folderActions";
type Folder = { id: string; title: string; icon?: string; desc?: string; folders: Folder[] };
export default function FolderInlineActions({folder,books,onAction,onClose}:{folder:Folder;books:Folder[];onAction:(action:FolderAction)=>void;onClose:()=>void}) {
 const [mode,setMode]=useState<"edit"|"add"|"move"|"delete"|null>(null);
 const [title,setTitle]=useState(folder.title),[icon,setIcon]=useState(folder.icon??"#"),[desc,setDesc]=useState(folder.desc??""),[symbols,setSymbols]=useState(false),[destination,setDestination]=useState("");
 const options:{id:string;label:string}[]=[];
 const walk=(nodes:Folder[],names:string[]=[])=>nodes.forEach(node=>{if(node.id===folder.id)return;const path=[...names,node.title];options.push({id:node.id,label:path.join(" / ")});walk(node.folders,path)});walk(books);
 const finish=(action:FolderAction)=>{onAction(action);onClose()};
 return <div className="mb-2 rounded-xl border border-[#e7edf2] bg-[#f8fafc] p-1.5 text-[10px] text-[#687887]" aria-label={`${folder.title} 관리 영역`}>
  <div className="flex min-w-0 items-center gap-1">
   <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto pb-0.5">
    {([{key:"add",label:"추가",Icon:FolderPlus},{key:"edit",label:"수정",Icon:Pencil},{key:"move",label:"이동",Icon:CornerUpRight},{key:"delete",label:"삭제",Icon:Trash2}] as const).map(({key,label,Icon})=><button key={key} aria-pressed={mode===key} onClick={()=>{setMode(key);setSymbols(false);if(key==="add"){setTitle("");setIcon("#");setDesc("")}else if(key==="edit"){setTitle(folder.title);setIcon(folder.icon??"#");setDesc(folder.desc??"")}}} className={`flex min-h-7 shrink-0 items-center gap-1 rounded-lg px-1 ${mode===key?"bg-[#e8f1f8] text-[#527895]":"hover:bg-white"}`}><Icon size={13} strokeWidth={1.6}/>{label}</button>)}
   </div>
   <button aria-label="폴더 관리 닫기" onClick={onClose} className="flex h-7 w-7 shrink-0 items-center justify-center"><X size={14}/></button>
  </div>
  {(mode==="edit"||mode==="add")&&<form className="mt-1.5 space-y-1.5" onSubmit={e=>{e.preventDefault();if(title.trim())finish({kind:mode,id:folder.id,title:title.trim(),icon,desc})}}>
   <div className="flex gap-2"><button type="button" aria-label="폴더 기호 변경" aria-expanded={symbols} onClick={()=>setSymbols(!symbols)} className="folder-symbol h-7 w-7 shrink-0 rounded-lg bg-white text-sm">{icon||"없음"}</button><input autoFocus aria-label={mode==="add"?"새 하위 폴더 이름":"폴더 이름"} placeholder="새 하위 폴더 이름" value={title} onChange={e=>setTitle(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-[#e1e9ef] bg-white px-2 text-sm outline-none focus:border-[#9bbbd2]"/></div>
   {symbols&&<FolderSymbolPicker value={icon} onChange={setIcon}/>}
   <input aria-label="폴더 설명" placeholder="설명 (선택)" value={desc} onChange={e=>setDesc(e.target.value)} className="h-7 w-full rounded-lg border border-[#e1e9ef] bg-white px-2 text-sm"/>
   <div className="flex justify-end"><button disabled={!title.trim()} className="rounded-lg bg-[#e2eff8] px-3 py-1.5 text-[#527895] disabled:opacity-40">{mode==="add"?"추가":"저장"}</button></div>
  </form>}
  {mode==="move"&&<div className="mt-1.5 space-y-1.5"><select aria-label="이동할 폴더" value={destination} onChange={e=>setDestination(e.target.value)} className="h-7 w-full min-w-0 rounded-lg border border-[#e1e9ef] bg-white px-2 text-sm"><option value="">최상위</option>{options.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select><div className="flex justify-end"><button onClick={()=>finish({kind:"move",id:folder.id,destination})} className="rounded-lg bg-[#e2eff8] px-3 py-1.5 text-[#527895]">여기로 이동</button></div></div>}
  {mode==="delete"&&<div className="mt-3"><p className="leading-relaxed">이 폴더와 안의 하위 폴더·단어를 모두 삭제할까요?</p><div className="mt-3 flex justify-end"><button onClick={()=>finish({kind:"delete",id:folder.id})} className="rounded-lg bg-[#fbeeee] px-4 py-2 text-[#b36565]">삭제하기</button></div></div>}
 </div>;
}
