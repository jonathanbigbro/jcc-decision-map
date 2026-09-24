import {comboBonus} from './synergy-engine.mjs';
export const STRATEGIES = [
 {id:'items',name:'装备定向',subtitle:'看可用成装与散件方向',max:30},
 {id:'units',name:'来牌定阵',subtitle:'看来牌数量与过渡质量',max:30},
 {id:'augments',name:'强化与纹章',subtitle:'看专属条件与阵容关联',max:20},
 {id:'economy',name:'经济运营',subtitle:'看血量、经济与战力',max:12}
];
export const STYLE = {reroll1:'1费追三',reroll2:'2费追三',reroll3:'3费追三',level8:'8级运营',level9:'9级上限'};
export function initialState(){return {stage:'2-1',hp:100,gold:10,level:4,strength:'unknown',econ:false,heroes:{},items:{},augments:[],contested:{}};}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function evaluate(state,data,catalog=null){
 const phase=Number(state.stage.split('-')[0]);
 const itemNames=Object.fromEntries(data.items.map(i=>[i.id,i.name]));
 const totalComponents=Object.entries(state.items).filter(([id])=>Number(id)<2000).reduce((n,[,v])=>n+v,0);
 const provided=Object.keys(state.heroes).length+Object.keys(state.items).length+state.augments.length;
 const results=data.comps.map(c=>{
  const reasons=[],gaps=[],risks=[],blocked=[];
  const count=state.heroes[c.carry]||0;
  const reroll=c.style.startsWith('reroll');
  const otherCore=c.core.filter(n=>n!==c.carry&&state.heroes[n]);
  const early=new Set(c.early.flat());
  const earlyMatches=Object.entries(state.heroes).filter(([n])=>early.has(n));
  let units=clamp(count*(reroll?4:7),0,22)+clamp(otherCore.length*3,0,6)+clamp(earlyMatches.length,0,2);
  units=clamp(units,0,30);
  if(count)reasons.push(`${c.carry}已持有${count}张${count>=3?'，已有二星所需数量':''}`);
  if(earlyMatches.length>=2)reasons.push(`${earlyMatches.map(([n])=>n).slice(0,3).join('、')}与样本过渡阵容重合`);
  if(reroll&&count<3)gaps.push(`${c.carry}数量不足，至少看到二星来牌再考虑投入`);
  if(!reroll&&!count)gaps.push(`后续还需找到${c.carry}，当前先用打工牌`);
  const full=c.items.filter(i=>!c.required.includes(i)&&state.items[i]);
  const componentCount=c.componentIds.reduce((n,i)=>n+(state.items[i]||0),0);
  const tankMatches=c.tankItems.filter(i=>state.items[i]&&!c.required.includes(i));
  let items=clamp(full.reduce((n,i)=>n+Math.min(state.items[i],2)*9,0)+Math.min(componentCount*3,12)+Math.min(tankMatches.length*2,4),0,30);
  const special=comboBonus(state,c,data,catalog);
  items=clamp(items+special.artifact,0,30);
  for(const r of special.matches)reasons.push(`${itemNames[r.itemId]} → ${r.hero} → ${c.name}，有${r.samples}个同装备体系样本支持（非胜率保证）`);
  if(full.length)reasons.push(`已有${full.map(i=>itemNames[i]).join('、')}，能用于该路线主C`);
  else if(componentCount>=2)reasons.push(`${componentCount}件散件偏向${c.role}，尚未计作已合成装备`);
  if(items<12)gaps.push('主C装备方向尚不充分，避免仅凭来牌硬玩');
  if(totalComponents>=3&&componentCount===0&&!full.length){items=Math.max(0,items-4);risks.push('当前散件与主C推荐方向不一致');}
  const augMatches=state.augments.filter(a=>c.augments.includes(a));
  let augments=Math.min(augMatches.length*6,12);
  if(augMatches.length)reasons.push(`${augMatches.map(id=>data.augments.find(a=>a.id===id)?.name).join('、')}在该阵容常见强化中（共现关联）`);
  for(const id of c.required){
   if(state.items[id]){augments+=14;reasons.push(`已满足${itemNames[id]}定向条件`);}
   else{blocked.push(`缺少${itemNames[id]}`);gaps.unshift(`样本构筑需要${itemNames[id]}，不能直接照搬`);}
  }
  augments=clamp(augments+special.emblem,0,20);
  const moneyLine=phase<=2?20:phase===3?40:50;
  const healthy=state.hp>=70;
  const moneyGood=state.gold>=moneyLine;
  let economy=6;
  if(c.style==='level9'){
   economy=(healthy?3:0)+(moneyGood?3:0)+(state.strength==='strong'?3:0)+(state.econ?3:0);
   if(state.level>=9)economy=12;
   if(state.level<8||!healthy||!moneyGood||state.strength!=='strong')gaps.push('九五只作远期分支：先在8级稳住，确认高血量和经济余量');
   if(state.hp<50&&state.level<9){blocked.push('当前血量不足以贪九五');risks.push('先找二星核心稳血，不建议直接冲9');}
  }else if(reroll){
   economy=clamp((count>=3?5:1)+(state.gold>=30?4:2)+(healthy?3:1),0,12);
   if(state.level>c.carryCost+4&&count<6){economy=1;risks.push('当前等级已偏高且核心少，追三成本较大');}
  }else{
   economy=clamp((moneyGood?5:2)+(healthy?4:1)+(state.strength==='strong'?3:1),0,12);
  }
  if(state.hp<40){risks.push('低血量优先即时战力，停止长时间等牌');if(count<3&&reroll)economy=0;}
  if(c.style==='level9'&&economy>=9)reasons.push('血量、经济和场面支持保留九五上限');
  const contest=state.contested[c.id]??0;
  const penalty=contest*(reroll?9:5);
  if(contest)risks.push(`${contest}家同行：${reroll?'追三路线明显降权':'共享高费核心，保留转阵空间'}`);
  const meta=clamp((5-c.avg)*5,0,8)*(c.samples/(c.samples+500));
  if(c.tier==='D')risks.push('当前数据源评级D，只在条件明显领先时考虑');
  if(c.samples<500)risks.push('阵容样本较少，强度判断保留不确定性');
  const raw=units+items+augments+economy+meta-penalty;
  const score=Math.round(clamp(raw-(blocked.length?25:0),0,100));
  const signals=[units>=12,items>=12,augments>=12,economy>=10].filter(Boolean).length;
  let commitment='保留方向';
  if(provided===0)commitment='等待开局信息';
  else if(blocked.length)commitment='条件未满足';
  else if(c.style==='level9'&&state.level<8)commitment='远期备选';
  else if(signals>=2&&score>=52&&(!reroll||count>=3)&&contest<2)commitment='可以围绕它投入';
  else if(signals<2)commitment='继续观察';
  let action=c.plan;
  if(state.hp<40)action=`先补当前最强战力稳血。${count>=3?`已有${c.carry}质量可围绕它补前排。`:'不要为未到手的核心继续空等。'}`;
  else if(blocked.length)action=`先补齐条件：${blocked.join('；')}。同时看另一条可执行路线。`;
  else if(phase===2&&commitment!=='可以围绕它投入')action='先保留两条能共用装备的路线；2-5看二星来牌，3-2结合第二个强化再复核。';
  return {...c,score,parts:{units:Math.round(units),items:Math.round(items),augments:Math.round(augments),economy:Math.round(economy),meta:Math.round(meta)},penalty,reasons,gaps,risks,blocked,commitment,action,signals};
 });
 results.sort((a,b)=>(Boolean(a.blocked.length)-Boolean(b.blocked.length))||b.score-a.score||b.samples-a.samples);
 return {results,empty:provided===0,phase,provided};
}

export function matchText(text,data){
 const clean=text.replace(/\s+/g,'');
 // No quantities, ownership or numeric game state are inferred from a name.
 const result={heroes:[],items:[],augments:[]};
 for(const kind of ['heroes','items','augments']){
  const rows=[...data[kind]].sort((a,b)=>b.name.length-a.name.length);
  let remaining=clean;
  for(const row of rows){
   if(row.name.length<2)continue;
   if(remaining.includes(row.name)){result[kind].push(row);remaining=remaining.split(row.name).join('');}
  }
 }
 return result;
}
