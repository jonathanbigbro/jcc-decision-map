const bound=(n,min,max)=>Math.max(min,Math.min(max,n));
export const isSpecial=item=>item?.kind==='artifact'||item?.kind==='emblem';

// Rankings describe observed samples, never a causal item benefit or win odds.
export function comboRoutes(state,data,catalog,itemId,sort='fit'){
 if(!catalog||catalog.meta.patch!==data.meta.patch||!data.meta.season.startsWith(`S${catalog.meta.seasonId} `))return [];
 const entry=catalog.items.find(i=>i.itemId===itemId);
 if(!entry)return [];
 const byId=new Map(data.items.map(i=>[i.id,i]));
 return entry.routes.map(r=>{
  const comp=catalog.comps.find(c=>c.id===r.compId);
  const profile=data.comps.find(c=>c.id===r.compId);
  const style=profile?.style||(comp.name.includes('95')?'level9':comp.carryCost<=3?`reroll${comp.carryCost}`:'level8');
  const needed={};
  for(const id of [...comp.required,itemId])needed[id]=1;
  const counts={};
  for(const id of r.items)if(isSpecial(byId.get(id)))counts[id]=(counts[id]||0)+1;
  for(const [id,count] of Object.entries(counts))needed[id]=Math.max(needed[id]||0,count);
  const missing=Object.entries(needed).filter(([id,count])=>(state.items[id]||0)<count).map(([id,count])=>({id,count:count-(state.items[id]||0)}));
  const heroCount=state.heroes[r.hero]||0,carryCount=state.heroes[comp.carry]||0;
  const overlap=comp.roster.filter(n=>state.heroes[n]>0);
  const contested=state.contested[r.compId]||0;
  const reliability=r.samples/(r.samples+200);
  const adjustedAvg=(r.avg*r.samples+4.5*200)/(r.samples+200);
  const strong=r.samples>=100&&r.carrierSamples>=50&&r.avg<=4.3&&r.carrierAvg<=4.5&&r.delta<0;
  const conditions=[];
  if(missing.length)conditions.push(`还缺${missing.map(m=>`${byId.get(m.id)?.name||m.id}${m.count>1?'×'+m.count:''}`).join('、')}`);
  if(!heroCount)conditions.push(`尚未找到${r.hero}，暂作后续方向`);
  else conditions.push(`${r.hero}已有${heroCount}张${heroCount>=3?'，达到二星所需数量':''}`);
  if(style.startsWith('reroll')&&carryCount<3)conditions.push(`${comp.carry}来牌不足，先保留方向再追三`);
  if(!style.startsWith('reroll')&&carryCount<3)conditions.push(`主C${comp.carry}尚未达到二星所需数量`);
  const companion=r.items.filter(id=>id!==itemId&&!isSpecial(byId.get(id)));
  const pending=companion.filter(id=>!state.items[id]);
  if(pending.length)conditions.push(`样本配装待补：${pending.map(id=>byId.get(id)?.name||id).join('、')}；可按实战替换`);
  const moneyNeeded=style.startsWith('reroll')?30:Number(state.stage.split('-')[0])<=2?20:40;
  const moneyLow=state.gold<moneyNeeded;
  if(moneyLow)conditions.push(`当前经济不足以持续投入，先保留方向并积累金币`);
  const lateReroll=style.startsWith('reroll')&&state.level>comp.carryCost+4&&carryCount<6;
  if(lateReroll)conditions.push('当前等级偏高且主C数量少，追三成本较大');
  const greedy=style==='level9'&&(state.level<8||state.gold<40||state.hp<70||state.strength!=='strong');
  if(greedy)conditions.push('九五先在8级稳血；高费终盘样本存在成型偏差');
  const danger=state.hp<40;
  if(danger)conditions.push('当前血量偏低，先补二星和前排，不为未到手的高费卡空等');
  if(contested)conditions.push(`${contested}家同行，降低这条路线的投入优先级`);
  if(r.samples<100||r.carrierSamples<50)conditions.push('携带样本偏少，只作探索备选');
  const variant=!comp.roster.includes(r.hero);
  if(variant)conditions.push('携带者来自体系变体，原始名单不含该英雄；需调整挂件后再使用');
  const rank=(4.5-adjustedAvg)*20+bound(-r.delta,-1,1)*6*reliability;
  const fit=rank+Math.min(heroCount,3)*4+Math.min(overlap.length*2,8)+Math.min(carryCount,3)*2
   -missing.length*14-(greedy?20:0)-(danger&&!heroCount?15:0)-contested*9-(variant?8:0);
  const ready=strong&&!missing.length&&heroCount>=3&&carryCount>=3&&overlap.length>=2
   &&companion.some(id=>state.items[id])&&!greedy&&!danger&&!moneyLow&&!lateReroll&&contested<2&&!variant;
  const status=missing.length?'条件未齐':greedy?'远期上限':danger?'先稳血':ready?'可优先围绕':heroCount?'已有来牌，可保留':'等核心来牌';
  const plan=profile?.plan||(style==='level9'?'先在8级补出二星主C与前排，有血量和经济余量再上9。':style.startsWith('reroll')?`${comp.carryCost+4}级观察${comp.carry}数量；来牌多、同行少再卡利息追三，低血先补即时战力。`:'用现有二星打工牌过渡，8级根据主C与前排来牌完成阵容。');
  return {...r,itemId,kind:entry.kind,comp,style,missing,heroCount,overlap,strong,ready,status,conditions,variant,rank,fit,plan};
 }).sort((a,b)=>(sort==='fit'?b.fit-a.fit:b.rank-a.rank)||b.samples-a.samples);
}

export function comboBonus(state,comp,data,catalog){
 const matches=[];
 for(const [id,count] of Object.entries(state.items)){
  if(count<=0||!isSpecial(data.items.find(i=>i.id===id)))continue;
  for(const r of comboRoutes(state,data,catalog,id)){
   if(r.compId===comp.id&&r.strong&&!r.missing.length&&!r.variant)matches.push(r);
  }
 }
 // Different special items are alternatives until equipment assignment is
 // known. Cap each dimension using its strongest verified route.
 return {matches,artifact:matches.some(r=>r.kind==='artifact')?9:0,
  emblem:matches.some(r=>r.kind==='emblem'&&!comp.required.includes(r.itemId))?8:0};
}
