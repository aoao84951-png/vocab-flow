import Hangul from 'hangul-js';

// iPadOS reports a Mac platform in desktop browsing mode.
export function isIPad(navigator: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>) {
  return /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

type Bookmark = { path: number[]; offset: number };
type Snapshot = { html: string; start?: Bookmark; end?: Bookmark };

/** Hardware-key workaround. Never blurs, refocuses, or replaces the editing host. */
export function attachIPadHardwareInput(el: HTMLElement, emit: () => void) {
  const doc = el.ownerDocument;
  let editing = false, guardUntil = 0;
  let run: { start: number; keys: string[]; output: string; html: string } | null = null;
  let undo: Snapshot[] = [], redo: Snapshot[] = [];
  const selection = () => {
    const sel = doc.getSelection();
    if (!sel?.rangeCount) return null;
    const range = sel.getRangeAt(0);
    return el.contains(range.startContainer) && el.contains(range.endContainer) ? range : null;
  };
  const bookmark = (node: Node, offset: number): Bookmark => {
    const path: number[] = [];
    while (node !== el && node.parentNode) {
      path.unshift(Array.prototype.indexOf.call(node.parentNode.childNodes, node)); node = node.parentNode;
    }
    return {path, offset};
  };
  const snap = (): Snapshot => {
    const range = selection();
    return {html:el.innerHTML, ...(range ? {start:bookmark(range.startContainer,range.startOffset), end:bookmark(range.endContainer,range.endOffset)} : {})};
  };
  let accepted = snap();
  const restore = (snapshot: Snapshot) => {
    el.innerHTML = snapshot.html;
    const resolve = (mark: Bookmark): [Node, number] => {
      let node: Node = el;
      for (const index of mark.path) node = node.childNodes[index] || node;
      return [node, Math.min(mark.offset, node.nodeType === Node.TEXT_NODE ? (node.textContent || '').length : node.childNodes.length)];
    };
    if (snapshot.start && snapshot.end) {
      const range = doc.createRange(); range.setStart(...resolve(snapshot.start)); range.setEnd(...resolve(snapshot.end));
      doc.getSelection()?.removeAllRanges(); doc.getSelection()?.addRange(range);
    }
    accepted = snap(); emit();
  };
  const push = (before: Snapshot) => { undo.push(before); if (undo.length > 100) undo.shift(); redo = []; };
  const offset = (node: Node, at: number) => { const range = doc.createRange(); range.selectNodeContents(el); range.setEnd(node, at); return range.toString().length; };
  const selectOffsets = (start: number, end: number) => {
    const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    const point = (target: number, preferNext: boolean): [Node, number] => {
      let seen = 0;
      for (let i = 0; i < nodes.length; i++) {
        const length = nodes[i].length;
        if (target < seen + length || (target === seen + length && (!preferNext || i === nodes.length - 1))) return [nodes[i], target - seen];
        seen += length;
      }
      return [el, el.childNodes.length];
    };
    const range = doc.createRange(); range.setStart(...point(start, true)); range.setEnd(...point(end, false));
    doc.getSelection()?.removeAllRanges(); doc.getSelection()?.addRange(range);
  };
  const command = (name: string, value?: string) => {
    editing = true;
    try { doc.execCommand(name, false, value); } finally { editing = false; }
  };
  const update = (before: Snapshot) => {
    if (before.html !== el.innerHTML) push(before);
    accepted = snap(); emit();
  };
  const history = (back: boolean) => {
    run = null; const from = back ? undo : redo, to = back ? redo : undo;
    const previous = from.pop(); if (!previous) return;
    to.push(snap()); restore(previous);
  };
  const keydown = (event: KeyboardEvent) => {
    if (el.contentEditable !== 'true' || !selection()) return;
    // Software keyboards and other IMEs must continue through the native path.
    if (event.isComposing || ['Process','Unidentified','Dead'].includes(event.key) || !event.code) {
      guardUntil = 0; run = null; return;
    }
    const key = event.key;
    if (event.ctrlKey || event.metaKey) {
      run = null;
      if (key.toLowerCase() === 'z') { event.preventDefault(); history(!event.shiftKey); }
      return;
    }
    if (event.altKey) { run = null; guardUntil = 0; return; }
    if (key === 'Tab' || key.startsWith('Arrow') || ['Home','End','Escape'].includes(key)) { run = null; return; }
    if (['Shift','Control','Alt','Meta','CapsLock'].includes(key)) return;
    if (key.length !== 1 && !['Backspace','Delete','Enter'].includes(key)) return;
    if (key.length === 1 && !/^[\x20-\x7eㄱ-ㅎㅏ-ㅣ]$/.test(key)) { native(); return; }
    // Only character keys with a physical-key code opt into this path.
    if (!/^(Key[A-Z]|Digit[0-9]|Numpad\w+|Space|Backspace|Delete|Enter|Intl\w+|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Backquote|Comma|Period|Slash)$/.test(event.code)) return;
    event.preventDefault(); guardUntil = performance.now() + 100;
    if (key === 'Enter') { run = null; return; } // These fields are single-line.
    const range = selection()!, before = snap();
    const at = offset(range.startContainer, range.startOffset);
    if (run && (!range.collapsed || at !== run.start + run.output.length || run.html !== el.innerHTML)) run = null;
    if (/^[ㄱ-ㅎㅏ-ㅣ]$/.test(key)) {
      if (!run) run = {start:at, keys:[], output:'', html:el.innerHTML};
      if (run.output) selectOffsets(run.start, run.start + run.output.length);
      run.keys.push(key); run.output = Hangul.assemble(run.keys);
      command('insertText', run.output); run.html = el.innerHTML;
    } else if (key === 'Backspace' && run?.keys.length) {
      selectOffsets(run.start,run.start + run.output.length);
      run.keys.pop(); run.output = Hangul.assemble(run.keys);
      command(run.output ? 'insertText' : 'delete', run.output || undefined);
      run.html = el.innerHTML; if (!run.keys.length) run = null;
    } else {
      run = null;
      command(key === 'Backspace' ? 'delete' : key === 'Delete' ? 'forwardDelete' : 'insertText', key.length === 1 ? key : undefined);
    }
    update(before);
  };
  const beforeinput = (event: InputEvent) => {
    if (editing) return;
    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
      if (event.cancelable) { event.preventDefault(); history(event.inputType === 'historyUndo'); } return;
    }
    if (performance.now() < guardUntil && /^(insert|delete)/.test(event.inputType)) {
      event.preventDefault(); return;
    }
    // No intercepted physical key: accept touch keyboard, dictation, paste, etc.
    run = null; accepted = snap();
  };
  const input = (event: Event) => {
    if (editing) { event.stopImmediatePropagation(); return; }
    if (event.isTrusted && performance.now() < guardUntil && event instanceof InputEvent && /^(insert|delete)/.test(event.inputType)) {
      event.stopImmediatePropagation(); restore(accepted); return;
    }
    run = null;
    if (accepted.html !== el.innerHTML) push(accepted);
    accepted = snap();
  };
  const commit = () => { run = null; };
  const native = () => { run = null; guardUntil = 0; accepted = snap(); };
  const focus = () => { run = null; accepted = snap(); };
  const paste = () => { native(); }; // The existing React paste handler inserts plain text.
  el.addEventListener('keydown',keydown);
  el.addEventListener('beforeinput',beforeinput);
  el.addEventListener('input',input,true);
  el.addEventListener('pointerdown',commit);
  el.addEventListener('blur',commit);
  el.addEventListener('focus',focus);
  el.addEventListener('compositionstart',native);
  el.addEventListener('paste',paste);
  el.addEventListener('cut',native);
  return {
    reset() { native(); undo = []; redo = []; },
    destroy() {
      el.removeEventListener('keydown',keydown); el.removeEventListener('beforeinput',beforeinput); el.removeEventListener('input',input,true);
      el.removeEventListener('pointerdown',commit); el.removeEventListener('blur',commit); el.removeEventListener('focus',focus);
      el.removeEventListener('compositionstart',native); el.removeEventListener('paste',paste); el.removeEventListener('cut',native);
    },
  };
}
