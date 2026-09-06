const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const mod={exports:{}};
new Function('exports','module',ts.transpileModule(fs.readFileSync('lib/selectionToolbarPosition.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod.exports,mod);
const {selectionToolbarPosition:place}=mod.exports;
for (const [label,selection,viewport] of [
 ['near top',{left:100,right:160,top:90,bottom:115},{left:0,top:0,width:390,height:700}],
 ['near bottom',{left:100,right:160,top:600,bottom:630},{left:0,top:0,width:390,height:700}],
 ['keyboard visible',{left:70,right:200,top:230,bottom:260},{left:0,top:100,width:390,height:320}],
]) test(label+' keeps expanded palette clear of selected text',()=>{
 const p=place(selection,viewport,264,292);
 assert.ok(p.top+p.maxHeight <= selection.top-8 || p.top >= selection.bottom+8);
 assert.ok(p.top>=viewport.top);assert.ok(p.top+p.maxHeight<=viewport.top+viewport.height);
 assert.ok(p.left>=viewport.left);assert.ok(p.left+264<=viewport.left+viewport.width);
});
