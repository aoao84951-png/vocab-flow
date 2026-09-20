// Browser regression checks for the actual mobile toolbar and action-bar components.
const fs = require('fs');
const path = require('path');
const repo = process.cwd();
const ts = require(path.join(repo, 'node_modules/typescript'));
const webpackModule = require(path.join(repo, 'node_modules/next/dist/compiled/webpack/webpack'));
const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'vocab-palette-'));
process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }));
const compile = (file, output, edit = s => s) => fs.writeFileSync(path.join(dir, output), ts.transpileModule(edit(fs.readFileSync(path.join(repo, file), 'utf8')), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
compile('lib/editorSelection.ts', 'selection.js');
compile('lib/mobileEditorViewport.ts', 'viewport.js');
compile('components/MobileEditorActions.tsx', 'actions.js', s => s.replace("'@/lib/mobileEditorViewport'", "'./viewport'"));
compile('components/MobileSelectionToolbar.tsx', 'toolbar.js', s => s.replace(/import \{ Bold,.*?from 'lucide-react';/, "const Bold = () => null, Italic = Bold, Underline = Bold, Strikethrough = Bold, RemoveFormatting = Bold, Palette = Bold, X = Bold, Plus = Bold;").replace("import styles from './MobileSelectionToolbar.module.css';", "const styles = new Proxy({}, {get: (_, key) => key});").replace("'@/lib/editorSelection'", "'./selection'").replace("'@/lib/mobileEditorViewport'", "'./viewport'"));
fs.writeFileSync(path.join(dir, 'entry.js'), `import React from 'react'; import {createRoot} from 'react-dom/client'; import Toolbar from './toolbar'; import Actions from './actions'; createRoot(document.getElementById('mount')).render(React.createElement(React.Fragment,null,React.createElement(Toolbar),React.createElement(Actions,null,'Save')));`);
webpackModule.webpack({mode:'development', entry:path.join(dir,'entry.js'),output:{path:dir,filename:'bundle.js'},resolve:{modules:[path.join(repo,'node_modules')]},devtool:false}, async (err,stats) => {
 if(err || stats.hasErrors()) throw err || Error(stats.toString());
 const {chromium,webkit} = require(path.join(repo,'node_modules/@playwright/test'));
 for (const [name,engine] of Object.entries({chromium,webkit})) {
  const browser = await engine.launch({headless:true});
  try {
   for(const nested of [false,true]) {
    const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const css=fs.readFileSync(path.join(repo,'components/MobileSelectionToolbar.module.css'),'utf8');
    await page.setContent(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box} body{margin:0} button{border:0;background:none} [data-mobile-editor-actions]{position:fixed;height:72px} ${css}</style><div id="scroll" style="${nested?'height:844px;overflow-y:auto':''}"><div data-word-editor><div style="height:4800px"></div><div contenteditable="true" style="padding:12px;min-height:48px">stroll past a bench</div><div id="mount"></div></div></div>`);
    await page.addScriptTag({path:path.join(dir,'bundle.js')});
    await page.waitForTimeout(150);
    const actionSpacing = await page.evaluate(()=>{
      const viewport = window.visualViewport;
      const field=document.querySelector('[contenteditable]');
      const spacer=document.querySelector('#mount > div[aria-hidden]');
      const normal=spacer.style.height;
      field.focus();
      Object.defineProperty(viewport,'height',{configurable:true,value:500});
      viewport.dispatchEvent(new Event('resize'));
      const keyboard=spacer.style.height;
      field.blur();
      delete viewport.height;
      viewport.dispatchEvent(new Event('resize'));
      return {normal,keyboard,restored:spacer.style.height};
    });
    if(actionSpacing.normal!=='72px'||actionSpacing.keyboard!=='356px'||actionSpacing.restored!=='72px') throw Error(JSON.stringify(actionSpacing));
    if(!nested){
      const source=fs.readFileSync(path.join(repo,'components/MobileApp.tsx'),'utf8');
      const handlers=source.slice(source.indexOf('    let startY = 0;'),source.indexOf('    html.style.overscrollBehaviorY'));
      await page.addScriptTag({content:'{const html=document.documentElement,body=document.body;'+ts.transpileModule(handlers,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText+`document.addEventListener('touchstart',handleTouchStart,{passive:true});document.addEventListener('touchmove',handleTouchMove,{passive:false});}`});
      const blocked=await page.evaluate(()=>{
        window.scrollTo(0,9999);
        const field=document.querySelector('[contenteditable]');
        const start=new Event('touchstart',{bubbles:true});start.touches=[{clientX:150,clientY:250}];field.dispatchEvent(start);
        const move=new Event('touchmove',{bubbles:true,cancelable:true});move.touches=[{clientX:150,clientY:200}];field.dispatchEvent(move);
        return move.defaultPrevented;
      });
      if(blocked) throw Error('native word editor pan blocked');
    }
    await page.evaluate(nested=>{
      const f=document.querySelector('[contenteditable]'); f.focus();
      if(nested) document.getElementById('scroll').scrollTop=9999; else window.scrollTo(0,9999);
      const r=document.createRange();r.setStart(f.firstChild,0);r.setEnd(f.firstChild,6);getSelection().removeAllRanges();getSelection().addRange(r); document.dispatchEvent(new Event('selectionchange'));
    },nested);
    await page.getByRole('button',{name:'글자색 및 배경색',exact:true}).click();
    const assertVisible=async()=>{
      const rects=await page.evaluate(()=>({selection:document.querySelector('.selectionPreview span').getBoundingClientRect().toJSON(),toolbar:document.querySelector('[role=toolbar]').getBoundingClientRect().toJSON()}));
      if(rects.selection.bottom>rects.toolbar.top-15 || rects.selection.top<0) throw Error(JSON.stringify(rects));
    };
    await assertVisible();
    if(await page.evaluate(()=>getSelection().rangeCount!==0||document.activeElement===document.querySelector('[contenteditable]'))) throw Error('native selection/focus survived palette opening');
    await page.getByRole('button',{name:'가 빨간색 텍스트',exact:true}).click();
    await assertVisible();
    const result=await page.evaluate(()=>({text:document.querySelector('[contenteditable]').textContent,focused:document.activeElement===document.querySelector('[contenteditable]'),nativeSelection:getSelection().rangeCount,html:document.querySelector('[contenteditable]').innerHTML}));
    if(result.text!=='stroll past a bench'||result.nativeSelection!==0||result.focused|| !result.html.includes('217, 81, 77')) throw Error(JSON.stringify(result));
    await page.getByRole('button',{name:'굵게',exact:true}).click();
    await page.getByRole('button',{name:'가 파란색 텍스트',exact:true}).click();
    if(!await page.evaluate(()=>document.querySelector('[contenteditable]').innerHTML.includes('57, 125, 204') && getSelection().rangeCount===0)) throw Error('repeated formatting lost target');
    await page.setViewportSize({width:390,height:640}); await page.waitForTimeout(200); await assertVisible();
    const scrollPositions=await page.evaluate(nested=>{
      const scroller=nested?document.getElementById('scroll'):document.scrollingElement;
      scroller.scrollTop-=80;
      const before=scroller.scrollTop;
      window.visualViewport.dispatchEvent(new Event('scroll'));
      return {before,after:scroller.scrollTop};
    },nested);
    if(scrollPositions.before!==scrollPositions.after) throw Error('palette fought user scrolling');
    await page.getByRole('button',{name:'색상 패널 닫고 키보드 열기',exact:true}).click();
    const children=await page.locator('[data-word-editor] > div').count();
    if(children!==3) throw Error('spacer not removed: '+children);
    await page.evaluate(()=>{
      const f=document.querySelector('[contenteditable]');f.focus();
      const walker=document.createTreeWalker(f,NodeFilter.SHOW_TEXT);const node=walker.nextNode();
      const r=document.createRange();r.setStart(node,0);r.setEnd(node,6);getSelection().removeAllRanges();getSelection().addRange(r);document.dispatchEvent(new Event('selectionchange'));
    });
    await page.getByRole('button',{name:'글자색 및 배경색',exact:true}).click();
    await assertVisible();
    await page.getByRole('button',{name:'색상 패널 닫고 키보드 열기',exact:true}).click();
    const closeScroll=await page.evaluate(nested=>{
      const scroller=nested?document.getElementById('scroll'):document.scrollingElement;
      scroller.scrollTop-=80;
      const before=scroller.scrollTop;
      window.visualViewport.dispatchEvent(new Event('scroll'));
      return {before,after:scroller.scrollTop,inputmode:document.querySelector('[contenteditable]').getAttribute('inputmode')};
    },nested);
    if(closeScroll.before!==closeScroll.after||closeScroll.inputmode!==null) throw Error('close failed: '+JSON.stringify(closeScroll));
    console.log(name,nested?'nested scroll':'page scroll','PASS: selection visible, color applied, resize handled, spacer removed');
    await page.close();
   }
  } finally {await browser.close()}
 }
});
