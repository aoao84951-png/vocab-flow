"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,ArrowUpRight} from 'lucide-react';
import AppearanceSettings from './AppearanceSettings';
import PronounceButtons from './PronounceButtons';
import {RichText} from './RichTextField';
import {localDay,selectDailyWords} from '@/lib/dailyWords';
type Word={id:string;word:string;memorized?:boolean;importanceStars?:number;meanings:{pos:string;items:string[]}[]};
type Folder={id:string;title:string;folders:Folder[];days:{id:string;title:string;words:Word[]}[]};
type Entry={word:Word;path:string[];dayId:string;index:number;location:string[]};
type Daily={date:string;ids:string[];checked:string[]};
const KEY='voca-daily-v1',HISTORY='voca-daily-history-v1';
export const LAST_STUDY_KEY='voca-last-study-v1';
export const LAST_LOCATION_KEY='voca-last-location-v1';
function read<T>(key:string,fallback:T):T{try{return JSON.parse(localStorage.getItem(key)||'null')||fallback;}catch{return fallback;}}
function write(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
export function rememberStudy(wordId:string){write(LAST_STUDY_KEY,wordId);}
export function rememberLocation(path:string[],dayId:string,index?:number){write(LAST_LOCATION_KEY,{path,dayId,index:index ?? -1});}
export default function DailyHome({books,onOpen,onContents}:{books:Folder[];onOpen:(path:string[],dayId:string,index:number)=>void;onContents:()=>void}){
 const entries=useMemo(()=>{const result:Entry[]=[];const walk=(folders:Folder[],path:string[],names:string[])=>folders.forEach(folder=>{
  const next=[...path,folder.id],titles=[...names,folder.title];
  folder.days.forEach(day=>day.words.forEach((word,index)=>result.push({word,path:next,dayId:day.id,index,location:[...titles,day.title]})));
  walk(folder.folders,next,titles);
 });walk(books,[],[]);return result;},[books]);
 const [date,setDate]=useState(localDay);const [daily,setDaily]=useState<Daily|null>(null);
 const [index,setIndex]=useState(0);const [revealed,setRevealed]=useState(false);const [last,setLast]=useState('');const [lastLocation,setLastLocation]=useState<{path:string[];dayId:string;index:number}|null>(null);
 const touch=useRef<{x:number;y:number}|null>(null);const swiped=useRef(false);
 useEffect(()=>{const id=setInterval(()=>setDate(localDay()),60000);const update=()=>setDate(localDay());window.addEventListener('focus',update);return()=>{clearInterval(id);window.removeEventListener('focus',update);};},[]);
 useEffect(()=>{
  setLast(read(LAST_STUDY_KEY,''));setLastLocation(read(LAST_LOCATION_KEY,null));
  if(!entries.length)return;
  let saved=read<Daily|null>(KEY,null);
  if(!saved||saved.date!==date){
   const history=read<Record<string,string>>(HISTORY,{});
   const ids=selectDailyWords(entries.map(entry=>entry.word),history);
   saved={date,ids,checked:[]};ids.forEach(id=>{history[id]=date;});
   const valid=new Set(entries.map(entry=>entry.word.id));Object.keys(history).forEach(id=>{if(!valid.has(id))delete history[id];});
   write(HISTORY,history);write(KEY,saved);setIndex(0);setRevealed(false);
  }
  setDaily(saved);
 },[entries,date]);
 const cards=useMemo(()=>daily?.ids.flatMap(id=>{const entry=entries.find(entry=>entry.word.id===id);return entry?[entry]:[];})||[],[daily,entries]);
 const current=cards[Math.min(index,Math.max(0,cards.length-1))];
 const resume=entries.find(entry=>entry.word.id===last);
 const locationResume=lastLocation?.dayId ? entries.find(entry=>entry.dayId===lastLocation.dayId && (lastLocation.index < 0 || entry.index===lastLocation.index)) : undefined;
 const resumeTarget=lastLocation?.dayId ? (locationResume || entries.find(entry=>entry.dayId===lastLocation.dayId)) : resume;
 const move=(offset:number)=>{setIndex(value=>Math.max(0,Math.min(cards.length-1,value+offset)));setRevealed(false);};
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{
   if(document.querySelector('[role="dialog"]')||(event.target instanceof HTMLElement&&(event.target.isContentEditable||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))))return;
   if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();setIndex(value=>Math.max(0,Math.min(cards.length-1,value+(event.key==='ArrowRight'?1:-1))));setRevealed(false);}
  };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[cards.length]);
 const reveal=()=>{if(swiped.current){swiped.current=false;return;}setRevealed(value=>!value);if(current&&daily&&!daily.checked.includes(current.word.id)){const next={...daily,checked:[...daily.checked,current.word.id]};setDaily(next);write(KEY,next);}};
 const checked=cards.filter(entry=>daily?.checked.includes(entry.word.id)).length;
 return <div className="mx-auto w-full max-w-[860px] px-5 pt-7 pb-8 sm:px-8 sm:pt-10">
  <header className="mb-7 flex items-center justify-between"><div><p className="mb-1 text-xs text-[#8b96a4]">{Number(date.slice(5,7))}월 {Number(date.slice(8))}일</p><h1 className="text-[28px] font-bold text-[#303236]">오늘의 단어</h1></div><AppearanceSettings/></header>
  {!current?<div className="rounded-3xl bg-[#f5f9fc] px-6 py-14 text-center"><p className="text-[#596275]">단어를 추가하면 매일 새로운 단어를 골라드려요.</p><button onClick={onContents} className="mt-5 rounded-full bg-[#dceefa] px-5 py-3 text-sm">목차 열기</button></div>:<>
   <div className="mb-3 flex items-center justify-between text-xs text-[#8a94a6]"><span>미암기 단어 중심 · 중요 단어 함께</span><span className="tabular-nums">{Math.min(index+1,cards.length)} / {cards.length}</span></div>
   <div onTouchStart={event=>{swiped.current=false;touch.current={x:event.touches[0].clientX,y:event.touches[0].clientY};}} onTouchEnd={event=>{if(!touch.current)return;const dx=event.changedTouches[0].clientX-touch.current.x,dy=event.changedTouches[0].clientY-touch.current.y;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3){swiped.current=true;move(dx<0?1:-1);}touch.current=null;}} className="relative rounded-[28px] border border-[#dce8f2] bg-[#f8fbfe] px-6 py-7 [touch-action:pan-y] sm:px-10">
    <div className="mb-4 flex min-h-6 items-center justify-between"><span className="folder-symbol text-lg">{'☆'.repeat(current.word.importanceStars||0)}</span><PronounceButtons text={current.word.word} className="rounded-full bg-white px-3 py-1.5 text-xs text-[#7390a7]">발음 듣기</PronounceButtons></div>
    <button type="button" onClick={reveal} aria-label={revealed?'뜻 숨기기':'뜻 보기'} aria-expanded={revealed} className="flex min-h-[220px] w-full flex-col items-center justify-center gap-6 text-center">
     <span className="break-words text-[36px] font-bold leading-tight text-[#303236] sm:text-[48px]"><RichText text={current.word.word}/></span>
     {revealed?<span className="space-y-2 text-base text-[#596275]">{current.word.meanings.map((meaning,i)=><span key={i} className="block"><span className="mr-2 rounded bg-[#dceefa] px-1.5 py-0.5 text-xs">{meaning.pos}</span><RichText text={meaning.items.join(', ')}/></span>)}</span>:<span className="text-sm text-[#98a6b5]">눌러서 뜻 확인하기</span>}
    </button>
    <div className="mt-5"><PathChips parts={current.location} centered /></div>
   </div>
   <div className="mt-4 flex items-center justify-between"><button aria-label="이전 오늘의 단어" disabled={index===0} onClick={()=>move(-1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4ebf1] text-[#7892a8] disabled:opacity-25"><ChevronLeft size={18}/></button><button onClick={()=>onOpen(current.path,current.dayId,current.index)} className="flex items-center gap-1 text-sm text-[#7892a8]">자세히 보기<ArrowUpRight size={15}/></button><button aria-label="다음 오늘의 단어" disabled={index>=cards.length-1} onClick={()=>move(1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4ebf1] text-[#7892a8] disabled:opacity-25"><ChevronRight size={18}/></button></div>
   <section className="mt-7"><div className="mb-2 flex justify-between text-sm"><span className="text-[#596275]">{checked===cards.length?'오늘의 단어를 모두 확인했어요':'오늘의 진행'}</span><span className="text-[#8a94a6]">{checked} / {cards.length}개 확인</span></div><div role="progressbar" aria-label="오늘의 단어 확인" aria-valuenow={checked} aria-valuemin={0} aria-valuemax={cards.length} className="h-1.5 overflow-hidden rounded-full bg-[#eef3f7]"><div className="h-full rounded-full bg-[#a9cbe1] transition-all" style={{width:`${checked/cards.length*100}%`}}/></div></section>
  </>}
  {resumeTarget&&<button onClick={()=>onOpen(locationResume?.path||resumeTarget.path,lastLocation?.dayId||resumeTarget.dayId,lastLocation ? (lastLocation.index >= 0 ? lastLocation.index : -1) : resumeTarget.index)} className="mt-8 flex w-full items-center justify-between gap-4 rounded-2xl border border-[#e7edf2] p-5 text-left"><span className="min-w-0"><span className="block text-xs text-[#8a94a6]">이어서 보기</span><span className="mt-1 block truncate font-semibold text-[#4b5058]"><RichText text={resumeTarget.word.word}/></span><span className="mt-1.5 block"><PathChips parts={locationResume?.location||resumeTarget.location} compact /></span></span><ArrowUpRight size={18} className="shrink-0 text-[#7892a8]"/></button>}
 </div>;
}

function PathChips({parts,centered=false,compact=false}:{parts:string[];centered?:boolean;compact?:boolean}) {
 const fullPath=parts.join(" → ");
 return <span aria-label={`위치: ${fullPath}`} title={fullPath} className={`flex min-w-0 max-w-full flex-nowrap items-center gap-1 overflow-hidden ${centered ? "justify-center" : "justify-start"}`}>
  {parts.map((part,index)=><span key={index} className={`inline-flex min-w-0 items-center gap-1 ${index===parts.length-1 ? "max-w-[35%] shrink-0" : "shrink"}`}>
   {index>0&&<ChevronRight aria-hidden="true" size={8} strokeWidth={1.5} className="shrink-0 text-[#bbc5ce]"/>}
   <span className={`min-w-0 truncate rounded px-[5px] py-[2px] leading-[1.3] ${compact ? "text-[9px]" : "text-[10px]"} ${index===parts.length-1 ? "bg-[#eaf3fa] text-[#7893a8]" : "bg-[#f3f5f7] text-[#8b97a3]"}`}>{part}</span>
  </span>)}
 </span>;
}
