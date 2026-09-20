"use client";

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Bold, Italic, Underline, Strikethrough, RemoveFormatting, Palette, X, Plus } from 'lucide-react';
import styles from './MobileSelectionToolbar.module.css';
import { mobileEditorScrollDelta } from '@/lib/mobileEditorViewport';
import { readEditorSelection, restoreEditorSelection, selectedEditorColors, paletteColorMatches, type EditorSelection } from '@/lib/editorSelection';

const names = ['기본', '회색', '갈색', '주황색', '노란색', '초록색', '파란색', '보라색', '분홍색', '빨간색'];
const colors = ['#303236', '#858585', '#a77c65', '#d57a36', '#c79832', '#4e9473', '#397dcc', '#9268bb', '#c54b88', '#d9514d'];
const backgrounds = ['transparent', '#efefed', '#f4eae5', '#fdebdc', '#faf3dd', '#e7eee9', '#e6f1fc', '#f1eaf8', '#f9e9f1', '#fce8e7'];
const actions = [[Bold, '굵게', 'bold'], [Underline, '밑줄', 'underline'], [Italic, '기울임', 'italic'], [Strikethrough, '취소선', 'strikeThrough'], [RemoveFormatting, '서식 지우기', 'removeFormat']] as const;

export default function MobileSelectionToolbar() {
  const root = useRef<HTMLDivElement>(null);
  const range = useRef<Range | null>(null);
  const editor = useRef<HTMLElement | null>(null);
  const paletteOpen = useRef(false);
  const panelHeight = useRef(300);
  const inputMode = useRef<{ field: HTMLElement; value: string | null } | null>(null);
  const refreshPreview = useRef<((reveal?: boolean) => void) | null>(null);
  const formattingSettle = useRef(0);
  const pendingSelection = useRef<EditorSelection | null>(null);
  const [revision, setRevision] = useState(0);
  const [selectedColors, setSelectedColors] = useState<{ text: string | null; background: string | null }>({ text: null, background: null });
  const [fontFamily, setFontFamily] = useState('inherit');
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [customHex, setCustomHex] = useState('#c79832');
  const [paletteTab, setPaletteTab] = useState<'text'|'background'>('text');

  const releaseKeyboard = () => {
    const previous = inputMode.current;
    if (!previous) return;
    if (previous.value === null) previous.field.removeAttribute('inputmode');
    else previous.field.setAttribute('inputmode', previous.value);
    previous.field.removeAttribute('data-mobile-formatting');
    inputMode.current = null;
  };
  const [visible, setVisible] = useState(false);
  const [palette, setPalette] = useState(false);
  const [active, setActive] = useState<string[]>([]);

  useEffect(() => {
    try { setCustomColors(JSON.parse(localStorage.getItem('vocab-custom-colors') || '[]')); } catch {}
    const hide = () => {
      releaseKeyboard();
      pendingSelection.current = null;
      paletteOpen.current = false;
      setPalette(false);
      setVisible(false);
    };
    const update = () => {
      if (paletteOpen.current || root.current?.contains(document.activeElement)) return;
      const selection = window.getSelection();
      if (!selection?.rangeCount || selection.isCollapsed) { hide(); return; }
      const next = selection.getRangeAt(0);
      const node = next.commonAncestorContainer;
      const field = (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>('[contenteditable="true"]');
      if (!field?.closest('[data-word-editor]') || !field.getClientRects().length) { hide(); return; }
      range.current = next.cloneRange();
      editor.current = field;
      const styledNode = next.startContainer instanceof Element ? next.startContainer : next.startContainer.parentElement;
      setFontFamily(getComputedStyle(styledNode || field).fontFamily || getComputedStyle(field).fontFamily || 'inherit');
      setSelectedColors(selectedEditorColors(field, next));
      setActive(actions.filter(([, , action]) => action !== 'removeFormat' && document.queryCommandState(action)).map(([, , action]) => action));
      setVisible(true);
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target) &&
          (paletteOpen.current || !editor.current?.contains(event.target))) hide();
    };
    const contextMenu = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-word-editor] [contenteditable="true"]')) event.preventDefault();
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') hide(); };
    document.addEventListener('selectionchange', update);
    document.addEventListener('pointerup', update);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    document.addEventListener('contextmenu', contextMenu);
    return () => {
      window.clearTimeout(formattingSettle.current);
      releaseKeyboard();
      document.removeEventListener('selectionchange', update);
      document.removeEventListener('pointerup', update);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key);
      document.removeEventListener('contextmenu', contextMenu);
    };
  }, []);

  useLayoutEffect(() => {
    if (!visible) return;
    // The fixed palette needs real scroll space, including at the end of the form.
    const spacer = document.createElement('div');
    const preview = palette ? document.createElement('div') : null;
    if (preview) {
      preview.className = styles.selectionPreview;
      preview.setAttribute('aria-hidden', 'true');
      document.body.appendChild(preview);
    }
    if (spacer) {
      spacer.setAttribute('aria-hidden', 'true');
      spacer.style.pointerEvents = 'none';
      editor.current?.closest('[data-word-editor]')?.appendChild(spacer);
    }
    const place = (revealSelection = false) => {
      const element = root.current;
      if (!element) return;
      if (!editor.current?.isConnected) { setVisible(false); return; }
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      element.style.left = `${viewport?.offsetLeft ?? 0}px`;
      element.style.width = `${viewport?.width ?? window.innerWidth}px`;
      element.style.top = `${(viewport?.offsetTop ?? 0) + height}px`;
      element.style.setProperty('--panel-height', `${Math.min(panelHeight.current, Math.max(100, height - 76))}px`);
      if (spacer) spacer.style.height = `${element.getBoundingClientRect().height + 16}px`;
      if (revealSelection && range.current) {
        // Prefer the selection to the whole field, which may span many lines.
        const selection = range.current.getBoundingClientRect();
        const target = selection.height ? selection : editor.current.getBoundingClientRect();
        const bounds = element.getBoundingClientRect();
        let remaining = mobileEditorScrollDelta(target, bounds.bottom, height, bounds.top);
        // Support both the page and an editor inside a scrolling container.
        for (let parent = editor.current.parentElement; parent && Math.abs(remaining) > 1; parent = parent.parentElement) {
          if (parent === document.scrollingElement || !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) continue;
          const before = parent.scrollTop;
          parent.scrollBy({ top: remaining, behavior: 'instant' });
          remaining -= parent.scrollTop - before;
        }
        if (Math.abs(remaining) > 1) window.scrollBy({ top: remaining, behavior: 'instant' });
      }
      if (preview) {
        const rects = range.current ? Array.from(range.current.getClientRects()) : [];
        preview.replaceChildren(...rects.filter(rect => rect.width && rect.height).map(rect => {
          const mark = document.createElement('span');
          Object.assign(mark.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
          return mark;
        }));
      }
    };
    // Reposition on scrolling, but never pull the user's scroll back to the selection.
    const reposition = () => place();
    let settle = 0;
    const resize = () => {
      place();
      window.clearTimeout(settle);
      settle = window.setTimeout(() => place(true), 120);
    };
    refreshPreview.current = place;
    place(true);
    const observer = new ResizeObserver(reposition);
    if (editor.current) observer.observe(editor.current);
    document.addEventListener('scroll', reposition, true);
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', reposition);
    window.addEventListener('resize', resize);
    return () => {
      window.clearTimeout(settle);
      window.clearTimeout(formattingSettle.current);
      observer.disconnect();
      refreshPreview.current = null;
      preview?.remove();
      spacer.remove();
      document.removeEventListener('scroll', reposition, true);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', reposition);
      window.removeEventListener('resize', resize);
    };
  }, [visible, palette]);

  const restore = (focus: boolean) => {
    if (!range.current || !editor.current?.isConnected) return false;
    if (focus) editor.current.focus({ preventScroll: true });
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range.current);
    return true;
  };
  // Restore after React has committed the input update as well as immediately.
  useLayoutEffect(() => {
    const bookmark = pendingSelection.current;
    const field = editor.current;
    if (!bookmark || !field?.isConnected) return;
    range.current = restoreEditorSelection(field, bookmark);
    if (range.current) setSelectedColors(selectedEditorColors(field, range.current));
    pendingSelection.current = null;
    if (paletteOpen.current) {
      field.blur();
      window.getSelection()?.removeAllRanges();
      refreshPreview.current?.();
      // Standalone iOS can pan after execCommand's temporary focus has ended.
      // Correct only this transition, never continuously during user scrolling.
      window.clearTimeout(formattingSettle.current);
      formattingSettle.current = window.setTimeout(() => {
        if (paletteOpen.current) refreshPreview.current?.(true);
      }, 180);
    }
  }, [revision]);

  const command = (name: string, value?: string) => {
    if (!restore(true) || !editor.current || !range.current) return;
    const bookmark = readEditorSelection(editor.current, range.current);
    pendingSelection.current = bookmark;
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(name, false, value);
    editor.current?.dispatchEvent(new Event('input', { bubbles: true }));
    range.current = restoreEditorSelection(editor.current, bookmark);
    if (range.current) setSelectedColors(selectedEditorColors(editor.current, range.current));
    setActive(actions.filter(([, , action]) => action !== 'removeFormat' && document.queryCommandState(action)).map(([, , action]) => action));
    if (paletteOpen.current) {
      editor.current.blur();
      window.getSelection()?.removeAllRanges();
      refreshPreview.current?.();
    }
    setRevision(value => value + 1);
  };
  const togglePalette = () => {
    const next = !paletteOpen.current;
    if (next) {
      const viewport = window.visualViewport;
      const keyboardHeight = window.innerHeight - (viewport?.height ?? window.innerHeight);
      panelHeight.current = Math.max(290, Math.min(380, keyboardHeight));
    }
    const field = editor.current;
    if (!field || !range.current) return;
    const bookmark = readEditorSelection(field, range.current);
    paletteOpen.current = next;
    if (next) {
      inputMode.current = { field, value: field.getAttribute('inputmode') };
      field.setAttribute('inputmode', 'none');
      field.setAttribute('data-mobile-formatting', 'true');
      // Keep the target range, not an active iOS selection/menu, while choosing colors.
      field.blur();
      range.current = restoreEditorSelection(field, bookmark);
      field.blur();
      window.getSelection()?.removeAllRanges();
      flushSync(() => setPalette(true));
    } else {
      releaseKeyboard();
      // End the selection before returning to typing, so Safari does not reopen its menu.
      range.current.collapse(false);
      window.getSelection()?.removeAllRanges();
      flushSync(() => { setPalette(false); setVisible(false); });
      // Let iOS reveal the caret as its keyboard opens. preventScroll restores
      // the pre-keyboard scroll position and leaves bottom fields underneath it.
      field.focus();
      restore(false);
    }
  };
  if (!visible) return null;
  return createPortal(
    <div ref={root} data-mobile-selection-toolbar style={{fontFamily}} className={`${styles.root} ${palette ? styles.expanded : ''}`} onPointerDown={event => { if ((event.target as Element).closest('button')) event.preventDefault(); }} onMouseDown={event => event.preventDefault()}>
      <div className={styles.toolbar} role="toolbar" aria-label="텍스트 서식">
        <div className={styles.strip}>
          {actions.map(([Icon, label, action]) => <button type="button" key={action} aria-label={label} aria-pressed={active.includes(action)} onClick={() => command(action)}><Icon /></button>)}
          <button type="button" aria-label="글자색 및 배경색" aria-expanded={palette} aria-controls="mobile-format-colors" className={palette ? styles.selected : ''} onClick={togglePalette}><Palette /></button>
        </div>
        <button type="button" className={styles.dismiss} aria-label={palette ? '색상 패널 닫고 키보드 열기' : '서식창 닫기'} onClick={() => {
          if (palette) togglePalette();
          else { editor.current?.blur(); window.getSelection()?.removeAllRanges(); setVisible(false); }
        }}><X /></button>
      </div>
      {palette && <div id="mobile-format-colors" className={styles.panel}>
        {(['text', 'background'] as const).map(kind => <section key={kind} aria-label={kind === 'text' ? '텍스트 색상' : '배경 색상'}>
          <h3>{kind === 'text' ? '텍스트 색상' : '배경 색상'}</h3>
          <div className={styles.grid}>{(kind === 'text' ? [...colors, ...customColors] : [...backgrounds, ...customColors]).map((color, index) => <button type="button" key={`${kind}-${color}`} aria-pressed={paletteColorMatches(selectedColors[kind], color)} onClick={() => command(kind === 'text' ? 'foreColor' : 'hiliteColor', color)}>
            {kind === 'text' ? <span className={styles.swatchText} style={{ color }}>가</span> : <span className={`${styles.swatch} ${index === 0 ? styles.defaultSwatch : ''}`} style={{ backgroundColor: color }} />}
            <span>{names[index]} {kind === 'text' ? '텍스트' : '배경'}</span>
          </button>)}</div>
        </section>)}
        <section className={styles.customSection} aria-label="내 색상"><h3>내 색상</h3><div className={styles.customTabs}><button className={paletteTab === 'text' ? styles.customActive : ''} onClick={() => setPaletteTab('text')}>글자색</button><button className={paletteTab === 'background' ? styles.customActive : ''} onClick={() => setPaletteTab('background')}>배경색</button></div><div className={styles.customRow}><input aria-label="내 색상 코드" value={customHex} onChange={event => setCustomHex(event.target.value)} placeholder="#c79832"/><button aria-label="내 색상 추가" onClick={() => { if (!/^#[\da-f]{6}$/i.test(customHex)) return; const next = Array.from(new Set([...customColors, customHex.toLowerCase()])); setCustomColors(next); localStorage.setItem('vocab-custom-colors', JSON.stringify(next)); command(paletteTab === 'text' ? 'foreColor' : 'hiliteColor', customHex); }}><Plus size={17}/></button></div></section>
      </div>}
    </div>, document.body,
  );
}
