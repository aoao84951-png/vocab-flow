const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { chromium, webkit } = require('@playwright/test');

// Real browser DOM/execCommand coverage, with hardware key events replayed.
// This does not emulate the iPad system IME; device behavior was validated in the v5–v9 trials.
for (const engine of [chromium, webkit]) test(`${engine.name()}: iPad rich input preserves formatting, editing, history and native fallback`, async () => {
  const browser = await engine.launch({headless:true});
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="a" contenteditable="true" tabindex="0"></div><div id="b" contenteditable="true" tabindex="0"></div>');
    await page.addScriptTag({path:require.resolve('hangul-js')});
    const badge = ts.transpileModule(fs.readFileSync('lib/caretLanguageIndicator.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
    await page.addScriptTag({content:`window.exports={};
${badge}
window.badgeExports=window.exports;`});
    const compiled = ts.transpileModule(fs.readFileSync('lib/ipadHardwareInput.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
    await page.addScriptTag({content:`window.exports={};window.require=name=>name==='hangul-js'?window.Hangul:window.badgeExports;\n${compiled}`});
    const results = await page.evaluate(() => {
      const a=document.querySelector('#a'),b=document.querySelector('#b'), controllers=[];
      let emitted=0,blurs=0;a.addEventListener('blur',()=>blurs++);
      for (const el of [a,b]) controllers.push(window.exports.attachIPadHardwareInput(el,()=>emitted++));
      const select=(el,start,end=start)=>{el.focus();const range=document.createRange();range.setStart(el.firstChild,start);range.setEnd(el.firstChild,end);getSelection().removeAllRanges();getSelection().addRange(range);};
      const caretEnd=el=>{el.focus();const r=document.createRange();r.selectNodeContents(el);r.collapse(false);getSelection().removeAllRanges();getSelection().addRange(r);};
      const key=(el,key,code='KeyA',extra={})=>{const event=new KeyboardEvent('keydown',{key,code,bubbles:true,cancelable:true,...extra});el.dispatchEvent(event);return event.defaultPrevented;};
      const type=(el,text)=>{for(const k of Hangul.disassemble(text))key(el,k,k===' '?'Space':'KeyA');};
      const reset=(el,html='')=>{el.innerHTML=html;controllers[el===a?0:1].reset();caretEnd(el);};
      const result={};
      reset(a);type(a,'입니다');const first=a.textContent;result.tabAllowed=!key(a,'Tab','Tab');caretEnd(b);type(b,'ㄹ');
      const stray=new InputEvent('beforeinput',{data:'달',inputType:'insertText',bubbles:true,cancelable:true});b.dispatchEvent(stray);
      key(b,'Backspace','Backspace');key(b,'Backspace','Backspace');result.transfer=[first,a.textContent,b.textContent,stray.defaultPrevented,a.isConnected,b.isConnected];
      result.words=[];
      for(const word of ['안녕하세요','값이','꽤','닭','읽어요','뛰다']){reset(a);type(a,word);result.words.push(a.textContent);for(const k of Hangul.disassemble(word))key(a,'Backspace','Backspace');if(a.textContent!=='')throw Error('backspace failed');}
      reset(a,'<b>앞</b><span style="color: rgb(255, 0, 0)">뒤</span>');
      const r=document.createRange();r.setStart(a.lastChild.firstChild,1);r.collapse(true);getSelection().removeAllRanges();getSelection().addRange(r);type(a,'한글');
      result.rich=[a.textContent,a.querySelector('b')?.textContent,a.querySelector('span')?.textContent];
      key(a,'z','KeyZ',{metaKey:true});key(a,'z','KeyZ',{metaKey:true,shiftKey:true});result.redo=a.innerHTML;
      reset(a,'앞뒤');select(a,1);type(a,'값이');result.middle=a.textContent;
      reset(a,'선택 교체');select(a,0,2);type(a,'새');result.replace=a.textContent;
      // Simulate toolbar formatting then use the controller's history.
      reset(a,'서식');select(a,0,2);document.execCommand('bold');a.dispatchEvent(new Event('input',{bubbles:true}));
      result.bold=!!a.querySelector('b');key(a,'z','KeyZ',{metaKey:true});result.undoBold=!a.querySelector('b')&&a.textContent==='서식';key(a,'z','KeyZ',{metaKey:true,shiftKey:true});result.redoBold=!!a.querySelector('b');
      reset(a);type(a,'가');result.softwareKeyAllowed=!key(a,'Unidentified','',{keyCode:229});
      const native=new InputEvent('beforeinput',{inputType:'insertText',data:'나',bubbles:true,cancelable:true});a.dispatchEvent(native);result.softwareInputAllowed=!native.defaultPrevented;
      document.execCommand('insertText',false,'나');result.softwareValue=a.textContent;
      // Paste is routed to the existing plain-text insertion handler.
      a.dispatchEvent(new Event('paste'));document.execCommand('insertText',false,' paste');result.paste=a.textContent;
      key(a,'z','KeyZ',{metaKey:true});result.undoPaste=a.textContent;
      result.device=[window.exports.isIPad({userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:5}),window.exports.isIPad({userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:0})];
      const before=blurs;type(a,'ㄹ');result.noForcedBlur=blurs===before;
      for(const c of controllers)c.destroy();result.detached=!key(a,'ㄹ');result.emitted=emitted;return result;
    });
    assert.equal(results.tabAllowed,true);assert.deepEqual(results.transfer,['입니다','입니다','',true,true,true]);
    assert.deepEqual(results.words,['안녕하세요','값이','꽤','닭','읽어요','뛰다']);
    assert.deepEqual(results.rich,['앞뒤한글','앞','뒤한글']);assert.match(results.redo,/뒤한글/);
    assert.equal(results.middle,'앞값이뒤');assert.equal(results.replace,'새 교체');
    for(const key of ['bold','undoBold','redoBold','softwareKeyAllowed','softwareInputAllowed','noForcedBlur','detached'])assert.equal(results[key],true,key);
    assert.equal(results.softwareValue,'가나');assert.equal(results.paste,'가나 paste');assert.equal(results.undoPaste,'가나');
    assert.deepEqual(results.device,[true,false]);assert(results.emitted>0);
    const local = await page.evaluate(() => {
      const a=document.querySelector('#a'), b=document.querySelector('#b');
      a.innerHTML=''; b.innerHTML='';
      const controllers=[a,b].map(el=>window.exports.attachIPadHardwareInput(el,()=>{},true));
      const focus=el=>{el.focus();const r=document.createRange();r.selectNodeContents(el);r.collapse(false);getSelection().removeAllRanges();getSelection().addRange(r);};
      const key=(el,code,key=code,extra={})=>el.dispatchEvent(new KeyboardEvent('keydown',{code,key,bubbles:true,cancelable:true,...extra}));
      focus(a);
      for(const code of ['KeyD','KeyL','KeyQ','KeyS','KeyL','KeyE','KeyK'])key(a,code,'x');
      focus(b); key(b,'KeyF','ㄹ');key(b,'Backspace');
      key(b,'CapsLock');
      for(const code of ['KeyA','KeyB','KeyC'])key(b,code,'ㅁ');
      key(b,'CapsLock');for(const code of ['KeyG','KeyK','KeyS','KeyR','KeyM','KeyF'])key(b,code,'x');
      const values=[a.textContent,b.textContent];
      for(let i=0;i<7;i++)key(b,'CapsLock');
      const badge=document.querySelector('.caret-language-badge');
      const label=badge.dataset.language;
      focus(a);key(a,'KeyA','ㅁ');key(a,'Digit1','1',{shiftKey:true});
      const shared=a.textContent;
      const modes=[a.inputMode,b.inputMode];
      for(const c of controllers)c.destroy();
      return {values,label,shared,modes,removed:!document.querySelector('.caret-language-badge'),restored:a.getAttribute('inputmode')};
    });
    assert.deepEqual(local.values,['입니다','abc한글']);
    assert.equal(local.label,'en');
    assert.equal(local.shared,'입니다a!');
    assert.deepEqual(local.modes,['none','none']);
    assert.equal(local.removed,true);assert.equal(local.restored,null);
    const multiline = await page.evaluate(() => {
      const el=document.querySelector('#b');el.innerHTML='';
      let emitted=0;
      const c=window.exports.attachIPadHardwareInput(el,()=>emitted++,true,true);
      el.focus();const r=document.createRange();r.selectNodeContents(el);r.collapse(false);getSelection().removeAllRanges();getSelection().addRange(r);
      const key=(code,key=code)=>el.dispatchEvent(new KeyboardEvent('keydown',{code,key,bubbles:true,cancelable:true}));
      key('CapsLock'); // Previous field left the shared mode in English.
      for(const code of ['KeyG','KeyK','KeyS'])key(code,'x');
      key('Enter');
      for(const code of ['KeyR','KeyM','KeyF'])key(code,'x');
      const lines=el.innerText.trim();
      key('Backspace');key('KeyF','x');
      const edited=el.innerText.trim();
      key('CapsLock');key('KeyA','ㅁ');
      const saved=el.innerHTML;
      const label=document.querySelector('.caret-language-badge').dataset.language;
      const inputMode=el.inputMode;
      c.destroy();
      return {lines,edited,saved,label,inputMode,emitted};
    });
    assert.equal(multiline.lines,'한\n글');
    assert.equal(multiline.edited,'한\n글');
    assert.match(multiline.saved,/한<br>글a/);
    assert.equal(multiline.label,'en');assert.equal(multiline.inputMode,'none');
    assert(multiline.emitted>0);

  } finally { await browser.close(); }
});
