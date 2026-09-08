"use client";

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bold, Italic, Underline, Strikethrough, RemoveFormatting, Palette, X } from 'lucide-react';
import styles from './MobileSelectionToolbar.module.css';
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
  const pendingSelection = useRef<EditorSelection | null>(null);
  const [revision, setRevision] = useState(0);
  const [selectedColors, setSelectedColors] = useState<{ text: string | null; background: string | null }>({ text: null, background: null });

  const releaseKeyboard = () => {
    const previous = inputMode.current;
    if (!previous) return;
    if (previous.value === null) previous.field.removeAttribute('inputmode');
    else previous.field.setAttribute('inputmode', previous.value);
    inputMode.current = null;
  };
  const [visible, setVisible] = useState(false);
  const [palette, setPalette] = useState(false);
  const [active, setActive] = useState<string[]>([]);

  useEffect(() => {
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
      if (!field?.closest('[data-word-editor]') || document.activeElement !== field) { hide(); return; }
      range.current = next.cloneRange();
      editor.current = field;
      setSelectedColors(selectedEditorColors(field, next));
      setActive(actions.filter(([, , action]) => action !== 'removeFormat' && document.queryCommandState(action)).map(([, , action]) => action));
      setVisible(true);
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) hide();
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') hide(); };
    document.addEventListener('selectionchange', update);
    document.addEventListener('pointerup', update);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    return () => {
      releaseKeyboard();
      document.removeEventListener('selectionchange', update);
      document.removeEventListener('pointerup', update);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key);
    };
  }, []);

  useLayoutEffect(() => {
    if (!visible) return;
    const place = () => {
      const element = root.current;
      if (!element) return;
      if (!editor.current?.isConnected) { setVisible(false); return; }
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      element.style.left = `${viewport?.offsetLeft ?? 0}px`;
      element.style.width = `${viewport?.width ?? window.innerWidth}px`;
      element.style.top = `${(viewport?.offsetTop ?? 0) + height}px`;
      element.style.setProperty('--panel-height', `${Math.min(panelHeight.current, Math.max(100, height - 76))}px`);
    };
    place();
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    window.addEventListener('resize', place);
    return () => {
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
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
    setRevision(value => value + 1);
    setActive(actions.filter(([, , action]) => action !== 'removeFormat' && document.queryCommandState(action)).map(([, , action]) => action));
  };
  const togglePalette = () => {
    const next = !paletteOpen.current;
    if (next) {
      const viewport = window.visualViewport;
      const keyboardHeight = window.innerHeight - (viewport?.height ?? window.innerHeight);
      panelHeight.current = Math.max(290, Math.min(380, keyboardHeight));
    }
    paletteOpen.current = next;
    setPalette(next);
    const field = editor.current;
    if (next && field && range.current) {
      const bookmark = readEditorSelection(field, range.current);
      inputMode.current = { field, value: field.getAttribute('inputmode') };
      // Keep the editable focused while the palette replaces the software keyboard.
      field.setAttribute('inputmode', 'none');
      field.blur();
      field.focus({ preventScroll: true });
      range.current = restoreEditorSelection(field, bookmark);
    } else {
      releaseKeyboard();
      field?.blur();
      restore(true);
    }
  };
  if (!visible) return null;
  return createPortal(
    <div ref={root} className={`${styles.root} ${palette ? styles.expanded : ''}`} onPointerDown={event => { if ((event.target as Element).closest('button')) event.preventDefault(); }} onMouseDown={event => event.preventDefault()}>
      <div className={styles.toolbar} role="toolbar" aria-label="텍스트 서식">
        <div className={styles.strip}>
          {actions.map(([Icon, label, action]) => <button type="button" key={action} aria-label={label} aria-pressed={active.includes(action)} onClick={() => command(action)}><Icon /></button>)}
          <button type="button" aria-label="글자색 및 배경색" aria-expanded={palette} aria-controls="mobile-format-colors" className={palette ? styles.selected : ''} onClick={togglePalette}><Palette /></button>
        </div>
        <button type="button" className={styles.dismiss} aria-label={palette ? '색상 패널 닫고 키보드 열기' : '서식창 닫기'} onClick={() => {
          if (palette) togglePalette();
          else { editor.current?.blur(); setVisible(false); }
        }}><X /></button>
      </div>
      {palette && <div id="mobile-format-colors" className={styles.panel}>
        {(['text', 'background'] as const).map(kind => <section key={kind} aria-label={kind === 'text' ? '텍스트 색상' : '배경 색상'}>
          <h3>{kind === 'text' ? '텍스트 색상' : '배경 색상'}</h3>
          <div className={styles.grid}>{(kind === 'text' ? colors : backgrounds).map((color, index) => <button type="button" key={color} aria-pressed={paletteColorMatches(selectedColors[kind], color)} onClick={() => command(kind === 'text' ? 'foreColor' : 'hiliteColor', color)}>
            {kind === 'text' ? <span className={styles.swatchText} style={{ color }}>가</span> : <span className={`${styles.swatch} ${index === 0 ? styles.defaultSwatch : ''}`} style={{ backgroundColor: color }} />}
            <span>{names[index]} {kind === 'text' ? '텍스트' : '배경'}</span>
          </button>)}</div>
        </section>)}
      </div>}
    </div>, document.body,
  );
}
