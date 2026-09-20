const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {chromium,webkit}=require('@playwright/test');
for(const engine of [chromium,webkit])test(`${engine.name()}: animated caret badge and uninterrupted language switching`,async()=>{
 const browser=await engine.launch();try{
 const page=await browser.newPage();await page.setContent(fs.readFileSync('public/diagnostics/focus-test-v9.html','utf8').replace(/<script[^>]*><\/script>/g,''));
 for(const file of ['vendor/hangul-0.2.6.min.js','hardware-hangul.js','local-keyboard-v8.js','caret-language-indicator-v9.js','focus-test-v9.js'])await page.addScriptTag({path:'public/diagnostics/'+file});
 await page.click('#start');await page.keyboard.type('dlqslek');assert.equal(await page.inputValue('#first'),'입니다');
 await page.keyboard.press('Tab');await page.keyboard.type('f');assert.equal(await page.inputValue('#second'),'ㄹ');await page.keyboard.press('Backspace');assert.equal(await page.inputValue('#second'),'');
 await page.keyboard.press('CapsLock');assert.match(await page.textContent('#local-language'),/English/);
 // Actual failing device supplies Korean event.key even after Caps Lock; use code instead.
 await page.evaluate(()=>{const el=document.querySelector('#second');for(const [code,key] of [['KeyA','ㅁ'],['KeyB','ㅠ'],['KeyC','ㅊ']])el.dispatchEvent(new KeyboardEvent('keydown',{code,key,bubbles:true,cancelable:true}));el.dispatchEvent(new KeyboardEvent('keydown',{key:'CapsLock',code:'CapsLock',repeat:true,bubbles:true,cancelable:true}));});
 assert.equal(await page.inputValue('#second'),'abc');assert.match(await page.textContent('#local-language'),/English/);
 await page.keyboard.press('CapsLock');await page.keyboard.type('gksrmf');assert.equal(await page.inputValue('#second'),'abc한글');
 await page.click('#outside');await page.click('#second');assert.deepEqual(await page.locator('textarea').evaluateAll(es=>es.map(e=>e.inputMode)),['none','none']);
 await page.keyboard.press('End');await page.keyboard.press('CapsLock');await page.keyboard.press('Shift+KeyA');await page.keyboard.press('Shift+Digit1');assert.equal(await page.inputValue('#second'),'abc한글A!');
 await page.click('#finish');await page.selectOption('#language','normal');await page.selectOption('#visibility','hidden');
 const [dl]=await Promise.all([page.waitForEvent('download'),page.click('#download')]);const r=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));
 assert.equal(r.version,9);assert.equal(r.trials[0].language,'normal');assert.equal(r.trials[0].events.filter(e=>e.type==='local-language-change').length,3);
 assert.equal(r.trials[0].firstInsert.data,'ㄹ');await page.click('#start');assert.match(await page.textContent('#local-language'),/한글/);
 // Regression: every Caps Lock in the device log is nonrepeat keydown with no keyup.
 const changes=await page.evaluate(()=>{
   const el=document.querySelector('#first'), labels=[];
   for(let i=0;i<8;i++){
     el.dispatchEvent(new KeyboardEvent('keydown',{key:'CapsLock',code:'CapsLock',repeat:false,bubbles:true,cancelable:true}));
     labels.push(document.querySelector('#caret-language-badge').dataset.language);
   }
   return labels;
 });
 assert.deepEqual(changes,['en','ko','en','ko','en','ko','en','ko']);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'first');
 const geometry=await page.evaluate(()=>{
   const field=document.querySelector('#first'), badge=document.querySelector('#caret-language-badge');
   const f=field.getBoundingClientRect(),b=badge.getBoundingClientRect();
   return {visible:!badge.hidden,x:b.x,y:b.y,left:f.left,top:f.top,bottom:f.bottom,width:innerWidth,height:innerHeight};
 });
 assert(geometry.visible);assert(geometry.x>=geometry.left && geometry.x<geometry.left+90);
 assert(geometry.y>=geometry.top && geometry.y<geometry.bottom+40);
 await page.waitForTimeout(280);
 assert.equal(await page.locator('#caret-language-badge').getAttribute('data-expanded'),'true');
 assert.equal(await page.locator('#caret-language-badge .language-thumb').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(220, 238, 250)');
 await page.screenshot({path:'/tmp/vocab-caret-expanded-'+engine.name()+'.png'});
 await page.waitForTimeout(650);
 assert.equal(await page.locator('#caret-language-badge').getAttribute('data-expanded'),'false');
 assert(Math.abs((await page.locator('#caret-language-badge').boundingBox()).width-44)<1);
 await page.screenshot({path:'/tmp/vocab-caret-compact-'+engine.name()+'.png'});
 await page.waitForTimeout(750);assert.equal(await page.locator('#caret-language-badge').isVisible(),false);
 await page.evaluate(()=>document.querySelector('#first').dispatchEvent(new KeyboardEvent('keydown',{key:'CapsLock',code:'CapsLock',bubbles:true,cancelable:true})));
 await page.click('#outside');assert.equal(await page.locator('#caret-language-badge').isVisible(),false);
 
 }finally{await browser.close();}
});
