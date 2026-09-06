"use client";
import { useEffect, useRef, type InputHTMLAttributes, type ChangeEvent } from 'react';
import { hasRichText, plainText, sanitizeRichText } from '@/lib/richText';
export function RichText({text}: {text: string}) {
  return <span dangerouslySetInnerHTML={{__html:sanitizeRichText(text).split(/(<[^>]+>)/g).map(part=>part.startsWith("<")?part:part.replace(/\[\[(.*?)\]\]/g, '<strong style="color:#d92d20">$1</strong>')).join("")}} />;
}
export default function RichTextField({value, onChange, placeholder, className, 'aria-label': label, disabled, autoFocus}: InputHTMLAttributes<HTMLInputElement>) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(autoFocus)ref.current?.focus();},[autoFocus]);
  const composing=useRef(false);
  const last=useRef(String(value ?? ''));
  useEffect(()=>{
    const next=String(value ?? '');
    if(ref.current && !composing.current && (last.current!==next || !ref.current.hasAttribute('data-initialized'))) {
      ref.current.innerHTML=sanitizeRichText(next);
      ref.current.setAttribute('data-initialized','true');last.current=next;
    }
  },[value]);
  const emit=()=>{
    const el=ref.current;if(!el)return;
    const html=sanitizeRichText(el.innerHTML);
    const next=plainText(html).trim() ? (hasRichText(html)?html:plainText(html)) : '';
    last.current=next;
    onChange?.({target:{value:next},currentTarget:{value:next}} as ChangeEvent<HTMLInputElement>);
  };
  return <div ref={ref} role="textbox" aria-label={label || placeholder} aria-disabled={disabled} tabIndex={disabled ? -1 : 0}
    contentEditable={!disabled} suppressContentEditableWarning data-rich-field data-placeholder={placeholder}
    className={`${className || ''} rich-text-field`} onInput={()=>{if(!composing.current)emit();}}
    onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;emit();}}
    onBlur={emit} onKeyDown={event=>{if(event.key==='Enter'&&!event.nativeEvent.isComposing)event.preventDefault();}}
    onPaste={event=>{event.preventDefault();document.execCommand('insertText',false,event.clipboardData.getData('text/plain'));emit();}} />;
}
