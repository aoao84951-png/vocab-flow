/* Diagnostic textarea caret badge. Measurement never edits or focuses the field. */
window.CaretLanguageIndicator = class {
  constructor() {
    this.badge = document.createElement('div');
    this.badge.id = 'caret-language-badge';
    this.badge.setAttribute('role','status'); this.badge.setAttribute('aria-live','polite');
    this.badge.style.cssText = 'position:fixed;z-index:1000;pointer-events:none;box-sizing:border-box;min-width:40px;height:30px;padding:2px 11px;border-radius:15px;background:#587fa3;color:#fff;font:600 17px/26px system-ui,sans-serif;text-align:center;box-shadow:0 3px 12px #30323620;border:1px solid #ffffff80;';
    this.badge.hidden = true; document.body.appendChild(this.badge);
    this.field = null; this.timer = null;
    this.hide = () => { clearTimeout(this.timer); this.badge.hidden = true; this.field = null; };
    document.addEventListener('focusout', event => { if(event.target === this.field) this.hide(); });
    document.addEventListener('selectionchange', () => { if(this.field) this.place(); });
    document.addEventListener('scroll',this.hide,true);
    window.addEventListener('blur',this.hide);
    window.addEventListener('resize',this.hide);
    window.visualViewport?.addEventListener('resize',this.hide);
    window.visualViewport?.addEventListener('scroll',this.hide);
  }
  show(field, language) {
    if (!(field instanceof HTMLTextAreaElement) || document.activeElement !== field) return;
    clearTimeout(this.timer); this.field = field;
    this.badge.textContent = language === 'ko' ? '한' : 'A';
    this.badge.setAttribute('aria-label',language === 'ko' ? '한국어 입력' : '영어 입력');
    this.badge.hidden = false; this.place();
    this.timer = setTimeout(this.hide,1100);
  }
  place() {
    const field = this.field; if(!field) return;
    const style = getComputedStyle(field), rect = field.getBoundingClientRect();
    const mirror = document.createElement('div');
    mirror.setAttribute('aria-hidden','true');
    for(const name of ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','wordSpacing','textIndent','textTransform','textAlign','direction','tabSize','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','borderStyle']) mirror.style[name] = style[name];
    mirror.style.position = 'fixed'; mirror.style.left = '-10000px'; mirror.style.top = '0'; mirror.style.visibility = 'hidden';
    mirror.style.boxSizing = 'border-box'; mirror.style.width = `${field.clientWidth + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)}px`;
    mirror.style.whiteSpace = 'pre-wrap'; mirror.style.overflowWrap = 'break-word';
    mirror.textContent = field.value.slice(0,field.selectionEnd);
    const marker = document.createElement('span'); marker.textContent = '\u200b'; mirror.appendChild(marker);
    mirror.appendChild(document.createTextNode(field.value.slice(field.selectionEnd)));
    document.body.appendChild(mirror);
    const mr = marker.getBoundingClientRect(), outer = mirror.getBoundingClientRect();
    let x = rect.left + mr.left - outer.left - field.scrollLeft;
    let y = rect.top + mr.bottom - outer.top - field.scrollTop + 6;
    mirror.remove();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    const right = left + (viewport?.width || innerWidth), bottom = top + (viewport?.height || innerHeight);
    if (rect.bottom < top || rect.top > bottom) { this.hide(); return; }
    const width = this.badge.offsetWidth, height = this.badge.offsetHeight;
    if (y + height > bottom - 6) y -= height + (parseFloat(style.lineHeight) || 26) + 12;
    this.badge.style.left = `${Math.max(left+6,Math.min(x,right-width-6))}px`;
    this.badge.style.top = `${Math.max(top+6,Math.min(y,bottom-height-6))}px`;
  }
};
