/* Diagnostic only. Hangul.js 0.2.6 (MIT) assembles hardware-key jamo.
 * Native text mutations are blocked; independent textarea nodes retain focus behavior.
 * This is not a production rich-text editor or a software-keyboard implementation.
 */
window.HardwareHangul = class {
  constructor(fields, enabled, report) {
    this.fields = fields; this.enabled = enabled; this.report = report;
    this.states = new Map();
    for (const field of fields) {
      this.states.set(field, { value: field.value, start: 0, end: 0, run: null, undo: [], redo: [] });
      field.addEventListener('keydown', event => this.key(field, event));
      field.addEventListener('focus', () => this.sync(field));
      field.addEventListener('blur', () => { this.states.get(field).run = null; });
      field.addEventListener('pointerdown', () => { this.states.get(field).run = null; });
      field.addEventListener('beforeinput', event => {
        if (!this.enabled()) return;
        event.preventDefault();
        this.report({ type: 'native-input-blocked', field: field.id, inputType: event.inputType, data: event.data, cancelable: event.cancelable });
      });
      field.addEventListener('input', () => {
        if (!this.enabled()) return;
        const state = this.states.get(field);
        if (field.value !== state.value) {
          const rejected = field.value;
          field.value = state.value; field.setSelectionRange(state.start, state.end);
          this.report({ type: 'unexpected-native-mutation-restored', field: field.id, rejected });
        }
      });
      field.addEventListener('paste', event => {
        if (!this.enabled()) return;
        event.preventDefault(); this.replace(field, event.clipboardData.getData('text/plain'));
      });
      field.addEventListener('cut', event => {
        if (!this.enabled()) return;
        event.preventDefault();
        if (field.selectionStart === field.selectionEnd) return;
        event.clipboardData.setData('text/plain', field.value.slice(field.selectionStart, field.selectionEnd));
        this.replace(field, '');
      });
      field.addEventListener('drop', event => { if (this.enabled()) event.preventDefault(); });
    }
  }
  reset() { for (const field of this.fields) { this.states.set(field, { value:field.value, start:field.selectionStart, end:field.selectionEnd, run:null, undo:[], redo:[] }); } }
  sync(field) {
    const state = this.states.get(field);
    state.value = field.value; state.start = field.selectionStart; state.end = field.selectionEnd; state.run = null;
  }
  save(field) {
    const state = this.states.get(field);
    state.undo.push({ value:field.value, start:field.selectionStart, end:field.selectionEnd });
    if (state.undo.length > 200) state.undo.shift();
    state.redo = [];
  }
  write(field, value, start, end = start) {
    const state = this.states.get(field);
    field.value = value; field.setSelectionRange(start, end);
    state.value = value; state.start = start; state.end = end;
    this.report({ type:'app-edit', field:field.id, value, start, end });
  }
  replace(field, text) {
    this.save(field); this.states.get(field).run = null;
    const start = field.selectionStart;
    this.write(field, field.value.slice(0,start) + text + field.value.slice(field.selectionEnd), start + text.length);
  }
  key(field, event) {
    if (!this.enabled()) return;
    const state = this.states.get(field), key = event.key;
    if (event.metaKey || event.ctrlKey) {
      state.run = null;
      if (key.toLowerCase() === 'z') {
        event.preventDefault();
        const from = event.shiftKey ? state.redo : state.undo, to = event.shiftKey ? state.undo : state.redo;
        const previous = from.pop();
        if (previous) { to.push({value:field.value,start:field.selectionStart,end:field.selectionEnd}); this.write(field, previous.value, previous.start, previous.end); }
      }
      return;
    }
    if (key === 'Tab' || key.startsWith('Arrow') || ['Home','End','Escape'].includes(key)) { state.run = null; return; }
    if (['Shift','Alt','Meta','Control','CapsLock'].includes(key)) return;
    if (key.length !== 1 && !['Backspace','Delete','Enter'].includes(key)) {
      state.run = null;
      this.report({type:'unsupported-key',field:field.id,key}); return;
    }
    event.preventDefault();
    const start = field.selectionStart, end = field.selectionEnd;
    if (state.run && (start !== end || start !== state.run.start + state.run.output.length || field.value !== state.value)) state.run = null;
    if (/^[ㄱ-ㅎㅏ-ㅣ]$/.test(key)) {
      this.save(field);
      if (!state.run) state.run = { start, keys:[], output:'', suffix:field.value.slice(end), prefix:field.value.slice(0,start) };
      const run = state.run; run.keys.push(key); run.output = window.Hangul.assemble(run.keys);
      this.write(field,run.prefix + run.output + run.suffix,run.start + run.output.length);
    } else if (key === 'Backspace' && state.run && state.run.keys.length) {
      this.save(field); const run = state.run; run.keys.pop(); run.output = window.Hangul.assemble(run.keys);
      this.write(field,run.prefix + run.output + run.suffix,run.start + run.output.length);
      if (!run.keys.length) state.run = null;
    } else if (key === 'Backspace' || key === 'Delete') {
      state.run = null;
      if (start !== end) this.replace(field,'');
      else if (key === 'Backspace' && start > 0) { const count = [...field.value.slice(0,start)].pop().length; field.setSelectionRange(start-count,end); this.replace(field,''); }
      else if (key === 'Delete' && end < field.value.length) { const count = [...field.value.slice(end)][0].length; field.setSelectionRange(start,end+count); this.replace(field,''); }
    } else this.replace(field,key === 'Enter' ? '\n' : key);
    this.report({type:'hardware-key-handled',field:field.id,key,defaultPrevented:event.defaultPrevented});
  }
};
