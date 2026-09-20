const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const mod={exports:{}};
new Function('exports','module',ts.transpileModule(fs.readFileSync('lib/mobileEditorViewport.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod.exports,mod);
const {mobileEditorScrollDelta:delta}=mod.exports;
// Captured from iOS 26.5 Safari with five learning-note examples and its keyboard.
// visualViewport.offsetTop=337, but Range rect=241..258 in visual coordinates.
test('iOS keyboard pan must not scroll an already visible selection down',()=>{
 assert.equal(delta({top:241,bottom:258},377,377,317),0);
});
test('caret hidden after keyboard opens is brought above its visible bottom',()=>{
 assert.equal(delta({top:578,bottom:595},377,377),234);
});
test('layout-relative and visual-relative rects produce the same movement',()=>{
 assert.equal(delta({top:578,bottom:595},377,377),delta({top:915,bottom:932},714,377));
});
test('a tall selection preserves its beginning without oscillating',()=>{
 assert.equal(delta({top:16,bottom:700},377,377,317),0);
});
