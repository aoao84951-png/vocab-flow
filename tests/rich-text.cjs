const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
function load(path, deps={}) {const module={exports:{}};new Function('exports','module','require',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(module.exports,module,name=>deps[name]);return module.exports;}
const rich=load('lib/richText.ts');
const {matchesWordSearch}=load('lib/wordSearch.ts',{'./richText':rich});
test('all browser-generated formats survive JSON persistence and sanitization',()=>{
 const html='<span style="font-weight: bold; font-style: italic; text-decoration-line: underline line-through; color: rgb(57, 125, 204); background-color: rgb(255, 244, 204);">increase</span>';
 const saved=JSON.parse(JSON.stringify({word:rich.sanitizeRichText(html)})).word;
 for(const rule of ['font-weight:bold','font-style:italic','text-decoration-line:underline line-through','color:rgb(57, 125, 204)','background-color:rgb(255, 244, 204)'])assert.ok(saved.includes(rule));
 assert.equal(rich.plainText(saved),'increase');
 assert.equal(rich.sanitizeRichText(saved),saved);
});
test('formatted fragments search and pronounce as a single word',()=>{
 const word={word:'in<b>cre</b>ase',meanings:[{items:['증<span style="color:#397dcc">가</span>']}]};
 assert.equal(rich.plainText(word.word),'increase');
 assert.ok(matchesWordSearch(word,'increase'));assert.ok(matchesWordSearch(word,'증가'));
 assert.ok(!matchesWordSearch(word,'span'));
 assert.equal(rich.plainText('a &amp; b'),'a & b');
});
test('untrusted HTML cannot retain scripts, attributes or unsafe CSS',()=>{
 const html=rich.sanitizeRichText('<b onclick="alert(1)">safe</b><img src=x onerror="alert(1)"><script>alert(1)</script><span style="position:fixed;background-image:url(x);color:#397dcc">ok</span>');
 assert.ok(!/<script|<img|onclick|onerror|position|url\(/.test(html));
 assert.ok(html.includes('color:#397dcc'));
 assert.equal(rich.sanitizeRichText('a < b & c'),'a &lt; b &amp; c');
});
