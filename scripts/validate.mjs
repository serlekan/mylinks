import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const root=new URL('../public/',import.meta.url);
const file=name=>readFileSync(new URL(name,root),'utf8');
const validateLink=l=>{
 assert.equal(typeof l.id,'string');assert.ok(l.id.trim(),'Unique ID required');
 assert.ok(typeof l.title==='string'&&l.title.trim(),'Title required');
 assert.ok(typeof l.description==='string'||l.description===undefined,'Description must be a string');
 assert.equal(typeof l.enabled,'boolean');
 const u=new URL(l.url);assert.ok(['http:','https:'].includes(u.protocol),'Only HTTP(S) URLs allowed');assert.equal(u.username,'');assert.equal(u.password,'');
};
test('valid content schema',()=>{
 const d=JSON.parse(file('data.json'));assert.equal(d.version,1);
 assert.ok(d.profile&&typeof d.profile.name==='string'&&d.profile.name.trim());
 assert.match(d.repository,/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
 assert.ok(Array.isArray(d.links));
 const ids=new Set();for(const link of d.links){validateLink(link);assert.ok(!ids.has(link.id),'Duplicate ID '+link.id);ids.add(link.id)}
});
test('all static assets exist',()=>{for(const path of ['index.html','app.js','editor.html','editor.js','styles.css','_headers','data.json']){assert.ok(existsSync(new URL(path,root)),path+' missing')}});
test('scripts parse',async()=>{const {spawnSync}=await import('node:child_process');for(const script of ['app.js','editor.js']){const p=spawnSync(process.execPath,['--check',new URL(script,root).pathname],{encoding:'utf8'});assert.equal(p.status,0,p.stderr)}});
test('editor never stores a token in browser storage',()=>{const src=file('editor.js');assert.ok(!/localStorage\.setItem\([^\n]*token/i.test(src));assert.ok(src.includes('github-token'));});
test('public app rejects unsafe URL protocols',()=>{const src=file('app.js');assert.ok(src.includes('u.protocol==="https:"'));assert.ok(src.includes('u.protocol==="http:"'));});
