import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialState,evaluate} from '../src/engine.mjs';
import {comboRoutes,comboBonus} from '../src/synergy-engine.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const data=read('../src/data.json'),catalog=read('../src/synergies.json');
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS',name);}
test('Every pair resolves to a real item, hero, build and equipment set',()=>{
 for(const item of catalog.items){
  assert(data.items.some(i=>i.id===item.itemId&&i.kind===item.kind));
  for(const r of item.routes){
   assert(data.heroes.some(h=>h.name===r.hero));
   assert(catalog.comps.some(c=>c.id===r.compId));
   assert(r.items.includes(item.itemId));
   assert(r.items.every(id=>data.items.some(i=>i.id===id)));
   assert(r.samples>=r.carrierSamples&&r.carrierSamples>0);
  }
 }
 for(const c of catalog.comps)assert(c.roster.every(n=>data.heroes.some(h=>h.name===n)));
});
test('Navori prefers Kayle in observed samples over most-played Aphelios',()=>{
 const r=comboRoutes(initialState(),data,catalog,'6087','sample');
 assert.equal(r[0].hero,'凯尔');assert(r[0].strong);
 assert(!r.find(r=>r.hero==='厄斐琉斯').strong);
});
test('Browsing never adds items or heroes and marks missing ownership',()=>{
 const state=initialState(),before=JSON.stringify(state);
 const rows=comboRoutes(state,data,catalog,'6087');
 assert.equal(JSON.stringify(state),before);
 assert(rows.every(r=>r.missing.some(m=>m.id==='6087')&&!r.ready));
});
test('Item-only opening never locks in a composition',()=>{
 const s={...initialState(),items:{6087:1}};
 assert(comboRoutes(s,data,catalog,'6087').every(r=>!r.ready));
 assert(evaluate(s,data,catalog).results.every(r=>r.commitment!=='可以围绕它投入'));
});
test('Verified artifact changes the main map without buffing its weak carriers',()=>{
 const s={...initialState(),items:{6087:1}};
 const base=evaluate(s,data),updated=evaluate(s,data,catalog);
 assert(updated.results.find(c=>c.id==='88').score>base.results.find(c=>c.id==='88').score);
 assert.equal(updated.results.find(c=>c.id==='95').score,base.results.find(c=>c.id==='95').score);
});
test('Recipe with two emblems keeps both requirements',()=>{
 const s={...initialState(),items:{41818:1}};
 const r=comboRoutes(s,data,catalog,'41818').find(r=>r.compId==='112');
 assert(r.missing.some(m=>m.id==='41806'));
 assert.equal(comboBonus(s,data.comps.find(c=>c.id==='112'),data,catalog).emblem,0);
});
test('Low health never offers an immediate commitment to level nine',()=>{
 const s={...initialState(),hp:29,level:7,gold:15,items:{41806:1},heroes:{'希维尔':3,'阿木木':3}};
 const r=comboRoutes(s,data,catalog,'41806').find(r=>r.compId==='112');
 assert(!r.ready);assert(r.conditions.some(s=>s.includes('血量偏低')));
});
test('Good existing Kayle opening can prioritize the artifact route',()=>{
 const s={...initialState(),stage:'3-2',gold:42,level:6,heroes:{'凯尔':5,'霞':3,'奥恩':3},items:{6087:1,2010:1}};
 const r=comboRoutes(s,data,catalog,'6087')[0];
 assert.equal(r.hero,'凯尔');assert(r.ready);
 s.contested['88']=2;assert(!comboRoutes(s,data,catalog,'6087').find(r=>r.compId==='88').ready);
});
test('Small samples cannot earn a strong label or engine bonus',()=>{
 const tiny=structuredClone(catalog);
 const item=tiny.items.find(i=>i.itemId==='6087');
 item.routes.forEach(r=>{r.samples=5;r.carrierSamples=5;r.avg=1;r.carrierAvg=1;r.delta=-3;});
 const s={...initialState(),items:{6087:1}};
 assert(comboRoutes(s,data,tiny,'6087').every(r=>!r.strong));
 assert.equal(comboBonus(s,data.comps.find(c=>c.id==='88'),data,tiny).artifact,0);
});
test('Ready label requires economy, main carry and companion equipment',()=>{
 const s={...initialState(),stage:'3-2',level:6,gold:42,heroes:{'凯尔':5,'霞':3},items:{6087:1}};
 assert(!comboRoutes(s,data,catalog,'6087').find(r=>r.compId==='88').ready);
 s.items['2010']=1;s.gold=0;
 assert(!comboRoutes(s,data,catalog,'6087').find(r=>r.compId==='88').ready);
 s.gold=42;s.level=8;
 assert(!comboRoutes(s,data,catalog,'6087').find(r=>r.compId==='88').ready);
});
test('Unrecorded artifacts and mismatched patches produce no invented pairs',()=>{
 assert.deepEqual(comboRoutes(initialState(),data,catalog,'6067'),[]);
 assert.deepEqual(comboRoutes(initialState(),data,{...catalog,meta:{...catalog.meta,patch:'19.1'}},'6087'),[]);
});
test('Variant carrier is disclosed rather than inserted into a roster',()=>{
 const rows=comboRoutes(initialState(),data,catalog,'41820');
 const r=rows.find(r=>r.compId==='119');
 assert(r.variant);assert(!r.comp.roster.includes(r.hero));assert(!r.ready);
});
console.log(`${passed} synergy checks passed`);
