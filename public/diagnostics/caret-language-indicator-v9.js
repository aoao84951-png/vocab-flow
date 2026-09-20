/* Diagnostic textarea caret badge. Measurement never edits or focuses the field. */
window.CaretLanguageIndicator = class {
  constructor() {
    this.badge = document.createElement('div');
    this.badge.id = 'caret-language-badge';
    this.badge.setAttribute('role','status'); this.badge.setAttribute('aria-live','polite');
    const style = document.createElement('style');
    style.textContent = `
      #caret-language-badge{position:fixed;z-index:1000;pointer-events:none;box-sizing:border-box;width:88px;height:34px;border-radius:18px;background:rgba(255,255,255,.94);border:1px solid #dce7ef;box-shadow:0 3px 14px #587fa31c;backdrop-filter:blur(12px);overflow:hidden;font:600 16px/32px system-ui,sans-serif;opacity:0;transform:translateY(-3px) scale(.96);transform-origin:20px 0;transition:opacity 160ms ease,transform 200ms cubic-bezier(.2,.8,.2,1),width 240ms cubic-bezier(.2,.8,.2,1),background-color 240ms ease,border-color 240ms ease}
      #caret-language-badge[data-visible="true"]{opacity:1;transform:translateY(0) scale(1)}
      #caret-language-badge[data-expanded="false"]{width:44px;background:#dceefa;border-color:#c9e2f2}
      #caret-language-badge .language-thumb{position:absolute;left:2px;top:2px;width:40px;height:28px;border-radius:15px;background:#dceefa;transform:translateX(0);transition:transform 220ms cubic-bezier(.2,.8,.2,1),opacity 180ms ease}
      #caret-language-badge[data-expanded="false"] .language-thumb{opacity:0}
      #caret-language-badge[data-language="en"][data-expanded="true"] .language-thumb{transform:translateX(42px)}
      #caret-language-badge .language-labels{position:relative;display:flex;width:84px;transform:translateX(0);transition:transform 240ms cubic-bezier(.2,.8,.2,1)}
      #caret-language-badge[data-language="en"][data-expanded="false"] .language-labels{transform:translateX(-42px)}
      #caret-language-badge .language-labels span{flex:0 0 42px;text-align:center;color:#858b94;transition:color 160ms ease}
      #caret-language-badge[data-language="ko"] .label-ko,#caret-language-badge[data-language="en"] .label-en{color:#426a8e}
      @media(prefers-reduced-motion:reduce){#caret-language-badge,#caret-language-badge *{transition:none!important}}
    `;
    document.head.appendChild(style);
    this.badge.innerHTML = '<span class="language-thumb" aria-hidden="true"></span><span class="language-labels" aria-hidden="true"><span class="label-ko">한</span><span class="label-en">A</span></span>';
    this.badge.hidden = true; document.body.appendChild(this.badge);
    this.field = null; this.timer = null; this.collapseTimer = null; this.exitTimer = null;
    this.hide = () => { clearTimeout(this.timer); clearTimeout(this.collapseTimer); clearTimeout(this.exitTimer); this.badge.hidden = true; this.badge.dataset.visible = 'false'; this.field = null; };
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
    clearTimeout(this.timer); clearTimeout(this.collapseTimer); clearTimeout(this.exitTimer);
    const fresh = this.badge.hidden || this.field !== field;
    this.field = field;
    this.badge.setAttribute('aria-label',language === 'ko' ? '한국어 입력' : '영어 입력');
    this.badge.dataset.expanded = 'true';
    if(fresh) {
      this.badge.dataset.visible = 'false';
      this.badge.dataset.language = language === 'ko' ? 'en' : 'ko';
      this.badge.hidden = false;
      this.place();
      void this.badge.offsetWidth;
    }
    this.badge.dataset.language = language;
    this.badge.dataset.visible = 'true';
    this.place();
    this.collapseTimer = setTimeout(() => { this.badge.dataset.expanded = 'false'; },650);
    this.timer = setTimeout(() => {
      this.badge.dataset.visible = 'false';
      this.exitTimer = setTimeout(this.hide,180);
    },1400);
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
    const width = 88, height = this.badge.offsetHeight;
    if (y + height > bottom - 6) y -= height + (parseFloat(style.lineHeight) || 26) + 12;
    this.badge.style.left = `${Math.max(left+6,Math.min(x,right-width-6))}px`;
    this.badge.style.top = `${Math.max(top+6,Math.min(y,bottom-height-6))}px`;
  }
};
