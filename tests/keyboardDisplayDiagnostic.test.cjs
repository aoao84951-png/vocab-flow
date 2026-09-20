const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('@playwright/test');
for(const engine of [chromium,webkit]) test(`${engine.name()}: keyboard display diagnostic modes and export`,async()=>{
 const browser=await engine.launch();
 try{
  const page=await browser.newPage();
  await page.setContent(fs.readFileSync('public/diagnostics/focus-test-v6.html','utf8').replace(/<script[^>]*><\/script>/g,''));
  for(const file of ['vendor/hangul-0.2.6.min.js','hardware-hangul.js','focus-test-v6.js']) await page.addScriptTag({path:'public/diagnostics/'+file});
  for(const mode of ['text','none']){
   await page.selectOption('#mode',mode);await page.click('#start');
   assert.deepEqual(await page.locator('textarea').evaluateAll(fields=>fields.map(el=>el.inputMode)),[mode,mode]);
   await page.evaluate(()=>{for(const key of Hangul.disassemble('입니다'))document.querySelector('#first').dispatchEvent(new KeyboardEvent('keydown',{key,code:'KeyA',bubbles:true,cancelable:true}));});
   await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'second');
   await page.evaluate(()=>{const el=document.querySelector('#second');for(const key of ['ㄹ','Backspace','a','b','c',...Hangul.disassemble('한글')])el.dispatchEvent(new KeyboardEvent('keydown',{key,code:'KeyA',bubbles:true,cancelable:true}));});
   assert.equal(await page.inputValue('#first'),'입니다');assert.equal(await page.inputValue('#second'),'abc한글');
   await page.click('#outside');assert.equal(await page.evaluate(()=>document.activeElement.id),'outside');
   await page.click('#second');assert.equal(await page.evaluate(()=>document.activeElement.id),'second');
   await page.click('#finish');
   for(const [id,value] of [['visibility',mode==='none'?'hidden':'visible'],['language','normal'],['flicker','no'],['lost','no'],['outcome','normal']])await page.selectOption('#'+id,value);
  }
  const [download]=await Promise.all([page.waitForEvent('download'),page.click('#download')]);
  const report=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  assert.equal(report.version,6);assert.equal(report.trials.length,2);
  assert.deepEqual(report.trials.map(t=>t.visibility),['visible','hidden']);
  for(const trial of report.trials){assert.equal(trial.firstInsert.data,'ㄹ');assert.equal(trial.final.second,'abc한글');assert.equal(trial.language,'normal');assert.equal(trial.navigation,'Tab');assert(trial.events.some(e=>e.type==='outside-focus'));}
 }finally{await browser.close();}
});
