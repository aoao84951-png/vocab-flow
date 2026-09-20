/* Diagnostic only: US-QWERTY/두벌식, with a page-local Caps Lock language mode. */
window.LocalKeyboard = class extends window.HardwareHangul {
  constructor(fields, enabled, report) {
    super(fields, enabled, report);
    this.language = 'ko'; this.capsHeld = false;
    for (const field of fields) {
      field.addEventListener('keyup', event => { if (event.code === 'CapsLock' || event.key === 'CapsLock') this.capsHeld = false; });
      field.addEventListener('blur', () => { this.capsHeld = false; });
    }
    window.addEventListener('blur', () => { this.capsHeld = false; });
  }
  reset() { super.reset(); this.language = 'ko'; this.capsHeld = false; }
  key(field, event) {
    if (!this.enabled()) return;
    if (event.code === 'CapsLock' || event.key === 'CapsLock') {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      if (event.repeat || this.capsHeld) return;
      this.capsHeld = true;
      this.language = this.language === 'ko' ? 'en' : 'ko';
      for (const state of this.states.values()) state.run = null;
      this.report({type:'local-language-change',language:this.language});
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      for (const state of this.states.values()) state.run = null;
      if (!event.altKey) super.key(field,event);
      return;
    }
    let key = event.key;
    if (/^Key[A-Z]$/.test(event.code)) {
      const letter = event.code.slice(3);
      const shifted = { E:'ㄸ', O:'ㅒ', P:'ㅖ', Q:'ㅃ', R:'ㄲ', T:'ㅆ', W:'ㅉ' };
      key = this.language === 'en' ? (event.shiftKey ? letter : letter.toLowerCase()) : (event.shiftKey && shifted[letter] || 'ㅁㅠㅊㅇㄷㄹㅎㅗㅑㅓㅏㅣㅡㅜㅐㅔㅂㄱㄴㅅㅕㅍㅈㅌㅛㅋ'[letter.charCodeAt(0)-65]);
    } else if (/^Digit[0-9]$/.test(event.code)) {
      const n = Number(event.code.slice(5)); key = event.shiftKey ? ')!@#$%^&*('[n] : String(n);
    } else {
      const punctuation = { Space:[' ',' '], Minus:['-','_'], Equal:['=','+'], BracketLeft:['[','{'], BracketRight:[']','}'], Backslash:['\\','|'], Semicolon:[';',':'], Quote:["'",'"'], Backquote:['`','~'], Comma:[',','<'], Period:['.','>'], Slash:['/','?'] };
      if (punctuation[event.code]) key = punctuation[event.code][event.shiftKey ? 1 : 0];
      else if (key.length === 1 && !/^Numpad/.test(event.code)) {
        event.preventDefault(); this.report({type:'unsupported-physical-key',code:event.code,key}); return;
      }
    }
    this.report({type:'local-key-mapped',code:event.code,rawKey:event.key,key,language:this.language,shift:event.shiftKey});
    super.key(field, { key, ctrlKey:event.ctrlKey, metaKey:event.metaKey,
      preventDefault:()=>event.preventDefault(), get defaultPrevented(){return event.defaultPrevented;} });
  }
};
