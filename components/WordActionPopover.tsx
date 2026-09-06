"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";
export default function WordActionPopover({anchor,onClose,onEdit,onDelete}:{anchor:HTMLElement;onClose:()=>void;onEdit:()=>void;onDelete:()=>void}) {
 const ref=useRef<HTMLDivElement>(null);
 const [position,setPosition]=useState<{left:number;top:number}|null>(null);
 useLayoutEffect(()=>{
  const menu=ref.current;if(!menu)return;
  const rect=anchor.getBoundingClientRect(),height=menu.offsetHeight,width=menu.offsetWidth;
  const nav=document.querySelector('nav[aria-label="주요 메뉴"]')?.getBoundingClientRect();
  const bottom=Math.min(window.innerHeight-8,nav?nav.top-12:window.innerHeight-8);
  const top=rect.bottom+6+height<=bottom?rect.bottom+6:Math.max(8,Math.min(rect.top-height-6,bottom-height));
  setPosition({left:Math.max(8,Math.min(rect.right-width,window.innerWidth-width-8)),top});
  menu.querySelector<HTMLButtonElement>('button')?.focus();
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();onClose();anchor.closest('button')?.focus()}};
  const scroll=(e:Event)=>{if(!menu.contains(e.target as Node))onClose()};
  window.addEventListener('resize',onClose);document.addEventListener('scroll',scroll,true);document.addEventListener('keydown',key);
  return ()=>{window.removeEventListener('resize',onClose);document.removeEventListener('scroll',scroll,true);document.removeEventListener('keydown',key)};
 },[anchor,onClose]);
 return createPortal(<><div className="fixed inset-0 z-[85]" onClick={onClose}/><div ref={ref} aria-label="단어 작업" className="fixed z-[90] w-36 rounded-xl border border-[#e2eaf1] bg-white p-1.5 text-sm shadow-[0_6px_22px_rgba(70,90,110,0.14)]" style={position??{visibility:"hidden"}}><button onClick={onEdit} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-[#61788c] hover:bg-[#f0f6fa] focus:bg-[#f0f6fa] focus:outline-none"><Pencil size={15} strokeWidth={1.6}/>수정</button><button onClick={onDelete} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-[#b66e6e] hover:bg-[#fcf2f2] focus:bg-[#fcf2f2] focus:outline-none"><Trash2 size={15} strokeWidth={1.6}/>삭제</button></div></>,document.body);
}
