"use client";
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Bold,Italic,Underline,Strikethrough,Palette,RemoveFormatting} from 'lucide-react';
const colors=['#303236','#858585','#a77c65','#d57a36','#c79832','#4e9473','#397dcc','#9268bb','#c54b88','#d9514d'];
const backgrounds=['transparent','#efefed','#f4eae5','#fdebdc','#fff4cc','#e5f2e9','#e3f0ff','#f0e8fb','#fbe5ef','#fde5e4'];
export default function SelectionToolbar(){
 const range=useRef<Range|null>(null);const editor=useRef<HTMLElement|null>(null);const toolbar=useRef<HTMLDivElement>(null);
 const [position,setPosition]=useState<{left:number;top:number}|null>(null);const [palette,setPalette]=useState(false);
 useEffect(()=>{
  const update=()=>{
   const selection=window.getSelection();
   if(toolbar.current?.contains(document.activeElement))return;
   if(!selection||selection.isCollapsed||!selection.rangeCount){setPosition(null);setPalette(false);return;}
   const next=selection.getRangeAt(0);const node=next.commonAncestorContainer;
   const field=(node instanceof Element?node:node.parentElement)?.closest<HTMLElement>('[contenteditable="true"]');
   if(!field?.closest('[data-word-editor]')){setPosition(null);return;}
   range.current=next.cloneRange();editor.current=field;
   const rect=next.getBoundingClientRect();const viewport=window.visualViewport;
   const leftEdge=viewport?.offsetLeft||0,topEdge=viewport?.offsetTop||0;
   const width=viewport?.width||window.innerWidth;
   setPosition({left:Math.max(leftEdge+8,Math.min(rect.left+rect.width/2-132,leftEdge+width-272)),top:rect.top-topEdge>60?rect.top-52:rect.bottom+8});
  };
  document.addEventListener('selectionchange',update);document.addEventListener('pointerup',update);
  const hide=()=>{setPosition(null);setPalette(false);};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape')hide();};
  const scroll=(event:Event)=>{if(!(event.target instanceof Node)||!toolbar.current?.contains(event.target))hide();};
  document.addEventListener('scroll',scroll,true);window.visualViewport?.addEventListener('resize',hide);document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('selectionchange',update);document.removeEventListener('pointerup',update);document.removeEventListener('scroll',scroll,true);window.visualViewport?.removeEventListener('resize',hide);document.removeEventListener('keydown',key);};
 },[]);
 const command=(name:string,value?:string)=>{
  if(!range.current||!editor.current?.isConnected)return;
  const selection=window.getSelection();editor.current.focus();selection?.removeAllRanges();selection?.addRange(range.current);
  document.execCommand('styleWithCSS',false,'true');document.execCommand(name,false,value);
  editor.current.dispatchEvent(new Event('input',{bubbles:true}));
  if(selection?.rangeCount)range.current=selection.getRangeAt(0).cloneRange();
 };
 if(!position)return null;
 return createPortal(<div ref={toolbar} role="toolbar" aria-label="텍스트 서식" style={{left:position.left,top:Math.max(window.visualViewport?.offsetTop || 8, Math.min(position.top, (window.visualViewport?.offsetTop || 0) + (window.visualViewport?.height || window.innerHeight) - (palette ? 292 : 52)))}}
  className="fixed z-[200] w-[264px] rounded-2xl border border-[#e2e7ed] bg-white p-1.5 text-[#535b65] shadow-[0_5px_24px_rgba(40,60,80,0.16)]"
  onPointerDown={event=>event.preventDefault()} onMouseDown={event=>event.preventDefault()}>
  <div className="flex justify-between">{[[Bold,'굵게','bold'],[Underline,'밑줄','underline'],[Italic,'기울임','italic'],[Strikethrough,'취소선','strikeThrough'],[RemoveFormatting,'서식 지우기','removeFormat']].map(([Icon,label,action])=>{
   const Component=Icon as typeof Bold;return <button type="button" key={String(action)} aria-label={String(label)} title={String(label)} className="flex h-9 w-10 items-center justify-center rounded-lg hover:bg-[#eff7fc]" onClick={()=>command(String(action))}><Component size={18}/></button>;
  })}<button type="button" aria-label="글자색 및 배경색" aria-expanded={palette} onClick={()=>setPalette(!palette)} className="flex h-9 w-10 items-center justify-center rounded-lg hover:bg-[#eff7fc]"><Palette size={18}/></button></div>
  {palette&&<div className="max-h-[240px] overflow-y-auto overscroll-contain border-t border-[#edf0f4] p-2">{[['글자색',colors,'foreColor'],['배경색',backgrounds,'hiliteColor']].map(([label,values,action])=><div key={String(label)}><p className="mb-2 mt-2 text-xs font-semibold text-[#858b94]">{String(label)}</p><div className="grid grid-cols-5 gap-2">{(values as string[]).map((color,index)=><button type="button" key={color} aria-label={`${label} ${index===0?'기본':color}`} title={color} className="h-8 rounded-lg border border-[#dce2e9] text-lg font-semibold" style={{color:action==='foreColor'?color:'#535b65',backgroundColor:action==='hiliteColor'?color:undefined}} onClick={()=>{command(String(action),color);setPalette(false);}}>{action==='foreColor'?'A':index===0?'∅':''}</button>)}</div></div>)}</div>}
 </div>,document.body);
}
