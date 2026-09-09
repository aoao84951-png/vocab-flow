"use client";
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Bold,Italic,Underline,Strikethrough,Palette,RemoveFormatting,Plus} from 'lucide-react';
import { selectionToolbarPosition } from "@/lib/selectionToolbarPosition";
const colors=['#303236','#858585','#a77c65','#d57a36','#c79832','#4e9473','#397dcc','#9268bb','#c54b88','#d9514d'];
const backgrounds=['transparent','#efefed','#f4eae5','#fdebdc','#fff4cc','#e5f2e9','#e3f0ff','#f0e8fb','#fbe5ef','#fde5e4'];
export default function SelectionToolbar(){
 const range=useRef<Range|null>(null);const editor=useRef<HTMLElement|null>(null);const toolbar=useRef<HTMLDivElement>(null);
 const [position,setPosition]=useState<{left:number;right:number;top:number;bottom:number}|null>(null);const [palette,setPalette]=useState(false);const [fontFamily,setFontFamily]=useState('inherit');const [custom,setCustom]=useState<string[]>([]);const [customHex,setCustomHex]=useState('#c79832');const [paletteTab,setPaletteTab]=useState<'text'|'background'>('text');
 const paletteColors=Array.from(new Set([...colors,...custom]));
 useEffect(()=>{try{setCustom(JSON.parse(localStorage.getItem('vocab-custom-colors')||'[]'))}catch{}},[]);
 useEffect(()=>{
  const update=()=>{
   const selection=window.getSelection();
   if(toolbar.current?.contains(document.activeElement))return;
   if(!selection||selection.isCollapsed||!selection.rangeCount){setPosition(null);setPalette(false);return;}
   const next=selection.getRangeAt(0);const node=next.commonAncestorContainer;
   const field=(node instanceof Element?node:node.parentElement)?.closest<HTMLElement>('[contenteditable="true"]');
   if(!field?.closest('[data-word-editor]')){setPosition(null);return;}
   range.current=next.cloneRange();editor.current=field;
   const styledNode = next.startContainer instanceof Element ? next.startContainer : next.startContainer.parentElement;
   setFontFamily(getComputedStyle(styledNode || field).fontFamily || getComputedStyle(field).fontFamily || 'inherit');
   const rect=next.getBoundingClientRect();
   setPosition({left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom});
  };
  document.addEventListener('selectionchange',update);document.addEventListener('pointerup',update);
  const hide=()=>{setPosition(null);setPalette(false);};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape')hide();};
  const scroll=(event:Event)=>{if(!(event.target instanceof Node)||!toolbar.current?.contains(event.target))hide();};
  document.addEventListener('scroll',scroll,true);window.visualViewport?.addEventListener('resize',hide);document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('selectionchange',update);document.removeEventListener('pointerup',update);document.removeEventListener('scroll',scroll,true);window.visualViewport?.removeEventListener('resize',hide);document.removeEventListener('keydown',key);};
 },[]);
 useLayoutEffect(()=>{
  const element=toolbar.current;
  if(!element||!position)return;
  const place=()=>{
   const viewport=window.visualViewport;
   element.style.maxHeight='none';
   const bounds=selectionToolbarPosition(position, {
    left:viewport?.offsetLeft || 0, top:viewport?.offsetTop || 0,
    width:viewport?.width || window.innerWidth, height:viewport?.height || window.innerHeight,
   }, element.getBoundingClientRect().width, element.scrollHeight + 2);
   element.style.left=`${bounds.left}px`;
   element.style.top=`${bounds.top}px`;
   element.style.maxHeight=`${bounds.maxHeight}px`;
   element.style.visibility=bounds.maxHeight > 0 ? 'visible' : 'hidden';
  };
  place();
 },[position,palette]);

 const command=(name:string,value?:string)=>{
  if(!range.current||!editor.current?.isConnected)return;
  const selection=window.getSelection();editor.current.focus();selection?.removeAllRanges();selection?.addRange(range.current);
  document.execCommand('styleWithCSS',false,'true');document.execCommand(name,false,value);
  editor.current.dispatchEvent(new Event('input',{bubbles:true}));
  if(selection?.rangeCount)range.current=selection.getRangeAt(0).cloneRange();
 };
 if(!position)return null;
 return createPortal(<div ref={toolbar} role="toolbar" aria-label="텍스트 서식" style={{visibility:"hidden",fontFamily}}
  className="fixed z-[200] w-[300px] max-w-[calc(100vw-16px)] overflow-y-auto overscroll-contain rounded-2xl border border-[#e2e7ed] bg-white p-1.5 text-[#535b65] shadow-[0_5px_24px_rgba(40,60,80,0.16)]"
  onPointerDown={event=>event.preventDefault()} onMouseDown={event=>event.preventDefault()}>
  <div className="flex justify-between">{[[Bold,'굵게','bold'],[Underline,'밑줄','underline'],[Italic,'기울임','italic'],[Strikethrough,'취소선','strikeThrough'],[RemoveFormatting,'서식 지우기','removeFormat']].map(([Icon,label,action])=>{
   const Component=Icon as typeof Bold;return <button type="button" key={String(action)} aria-label={String(label)} title={String(label)} className="flex h-9 w-10 items-center justify-center rounded-lg hover:bg-[#eff7fc]" onClick={()=>command(String(action))}><Component size={18}/></button>;
  })}<button type="button" aria-label="글자색 및 배경색" aria-expanded={palette} onClick={()=>setPalette(!palette)} className="flex h-9 w-10 items-center justify-center rounded-lg hover:bg-[#eff7fc]"><Palette size={18}/></button></div>
  {palette&&<div className="max-h-[300px] overflow-y-auto overscroll-contain border-t border-[#edf0f4] p-2">{[['글자색',paletteColors,'foreColor'],['배경색',[...backgrounds,...custom],'hiliteColor']].map(([label,values,action])=><div key={String(label)}><p className="mb-2 mt-2 text-xs font-semibold text-[#858b94]">{String(label)}</p><div className="grid grid-cols-5 gap-2">{(values as string[]).map((color,index)=><button type="button" key={color} aria-label={`${label} ${index===0?'기본':color}`} title={color} className="h-8 rounded-lg border border-[#dce2e9] text-lg font-semibold" style={{color:action==='foreColor'?color:'#535b65',backgroundColor:action==='hiliteColor'?color:undefined}} onClick={()=>{command(String(action),color);}}>{action==='foreColor'?'A':index===0?'∅':''}</button>)}</div></div>)}<div className="mt-3 border-t border-[#edf0f4] pt-2"><div className="flex gap-1 rounded-lg bg-[#eff7fc] p-1"><button className={`flex-1 rounded-md py-1 text-xs ${paletteTab==='text'?'bg-white text-[#587fa3]':''}`} onClick={()=>setPaletteTab('text')}>글자색</button><button className={`flex-1 rounded-md py-1 text-xs ${paletteTab==='background'?'bg-white text-[#587fa3]':''}`} onClick={()=>setPaletteTab('background')}>배경색</button></div><div className="mt-2 flex gap-1"><input aria-label="내 색상 코드" value={customHex} onChange={e=>setCustomHex(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-[#dce2e9] px-2 text-xs"/><button aria-label="내 색상 추가" className="rounded-lg bg-[#dceefa] px-2 text-[#587fa3]" onClick={()=>{if(!/^#[\da-f]{6}$/i.test(customHex))return;const next=Array.from(new Set([...custom,customHex.toLowerCase()]));setCustom(next);localStorage.setItem('vocab-custom-colors',JSON.stringify(next));command(paletteTab==='text'?'foreColor':'hiliteColor',customHex);}}><Plus size={14}/></button></div></div></div>}
 </div>,document.body);
}
