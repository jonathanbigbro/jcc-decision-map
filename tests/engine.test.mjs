import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialState,evaluate,matchText} from '../src/engine.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../src/data.json',import.meta.url),'utf8'));
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS',name);}
test('Empty input never presents a committed composition',()=>{const r=evaluate(initialState(),data);assert(r.empty);assert(r.results.every(c=>c.commitment==='等待开局信息'));});
test('Caitlyn opening selects a Caitlyn line',()=>{const s={...initialState(),stage:'2-5',gold:25,level:5,heroes:{'凯特琳':4,'伊莉丝':3,'洛':3},items:{1001:1,1002:2,1003:1}};assert.equal(evaluate(s,data).results[0].id,'100');});
test('AP attack speed with Kayle changes the recommended carry',()=>{const s={...initialState(),stage:'3-2',gold:42,level:6,heroes:{'凯尔':5,'霞':3,'奥恩':3,'蕾欧娜':3},items:{2010:1,2038:1,1005:1}};assert.equal(evaluate(s,data).results[0].id,'88');});
test('Inferno emblem is a hard prerequisite',()=>{const s={...initialState(),heroes:{'希维尔':3},items:{2004:1,2009:1}};const c=evaluate(s,data).results.find(c=>c.id==='112');assert(c.blocked.some(x=>x.includes('纹章')));s.items[41806]=1;assert(!evaluate(s,data).results.find(c=>c.id==='112').blocked.some(x=>x.includes('纹章')));});
test('Low health blocks a greedy level nine plan',()=>{const s={...initialState(),stage:'4-2',hp:29,level:7,gold:16,items:{41806:1,2004:1},heroes:{'希维尔':1}};assert(evaluate(s,data).results.find(c=>c.id==='112').blocked.length);assert(evaluate(s,data).results.find(c=>c.id==='89').blocked.length);});
test('Early nine-cost plan remains distant even when signals align',()=>{const s={...initialState(),gold:45,strength:'strong',econ:true,items:{41806:1,2004:1,2009:1},heroes:{'希维尔':3}};assert.equal(evaluate(s,data).results.find(c=>c.id==='112').commitment,'远期备选');});
test('Multiple contested reroll players reduce its score',()=>{const s={...initialState(),heroes:{'凯特琳':6,'伊莉丝':3},items:{2010:1,2045:1}};const before=evaluate(s,data).results.find(c=>c.id==='100').score;s.contested={'100':2};assert(evaluate(s,data).results.find(c=>c.id==='100').score<before);assert.notEqual(evaluate(s,data).results.find(c=>c.id==='100').commitment,'可以围绕它投入');});
test('Single component alone cannot force composition commitment',()=>{const s={...initialState(),items:{1003:1}};assert(evaluate(s,data).results.every(c=>c.commitment!=='可以围绕它投入'));});
test('No shadow duplicate from compound names in screenshot text',()=>{const r=matchText('光明版无尽之刃 凯特琳 飞升',data);assert(r.items.some(x=>x.name==='光明版无尽之刃'));assert(!r.items.some(x=>x.name==='无尽之刃'));assert(r.heroes.some(x=>x.name==='凯特琳'));assert(r.augments.some(x=>x.name==='飞升'));});
test('Roster, item and augment references resolve',()=>{for(const c of data.comps){assert(c.roster.every(n=>data.heroes.some(h=>h.name===n)));assert(c.items.every(id=>data.items.some(i=>i.id===id)));assert(c.required.every(id=>data.items.some(i=>i.id===id)));}});
console.log(`${passed} engine checks passed`);
