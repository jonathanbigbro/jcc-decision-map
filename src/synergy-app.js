(() => {
 let itemId=null,routeKey=null;
 window.comboActive=false;
 const item=id=>lookup('items',id);
 const key=r=>`${r.compId}:${r.heroId}`;
 const fmt=n=>Number(n).toLocaleString('zh-CN');
 const chips=ids=>ids.map(id=>`<span class="item-chip">${icon(item(id))}${esc(item(id)?.name||id)}</span>`).join('');
 const roster=names=>names.map(n=>`<span class="combo-unit ${state.heroes[n]?'owned':''}">${icon(lookup('heroes',n))}<span>${esc(n)}</span>${state.heroes[n]?'<b>已有</b>':''}</span>`).join('');
 function available(){
  const q=$('#comboSearch').value.trim().toLowerCase(),kind=$('#comboKind').value,owned=$('#comboOwned').checked;
  return DATA.items.filter(i=>isSpecial(i)&&(kind==='all'||i.kind===kind)&&(!owned||state.items[i.id]>0)&&(i.name+(aliases[i.name]||'')).toLowerCase().includes(q));
 }
 function show(active,id){
  window.comboActive=active;
  document.body.classList.toggle('combo-mode',active);
  $('#comboView').hidden=!active;
  for(const [sel,on] of [['#mapTab',!active],['#comboTab',active]]){
   $(sel).classList.toggle('active',on);$(sel).setAttribute('aria-pressed',String(on));
  }
  if(active){itemId=id||Object.keys(state.items).find(id=>isSpecial(item(id)))||itemId||'41806';routeKey=null;}
  renderMap();
 }
 function showInspector(r){
  if(!r){$('#inspector').innerHTML='<h2>先选一件纹章或神器</h2><div class="empty-inspector"><p>查看携带英雄、配套装备与体系。没有足够样本的条目会明确标注。</p></div>';return;}
  const absent=r.comp.roster.filter(n=>!state.heroes[n]);
  $('#inspector').innerHTML=`<h2>这条组合怎么走</h2><article class="recommendation combo-detail"><div class="rec-head"><span class="combo-kicker">${esc(item(itemId).name)} → ${esc(r.hero)}</span><h3>${esc(r.comp.name)}</h3><p>${STYLE[r.style]} · ${r.status}</p></div><div class="rec-body"><h4>装备给谁</h4><div class="combo-carrier">${icon(lookup('heroes',r.hero))}<div><strong>${esc(r.hero)}</strong><p>${r.hero===r.comp.carry?'这条体系的主C':'装备携带者；体系主C为'+esc(r.comp.carry)}</p></div></div><p>该英雄携带装备组合的 ${fmt(r.carrierSamples)} 个样本，平均排名 ${r.carrierAvg.toFixed(2)}，前四率 ${r.carrierTop4.toFixed(1)}%。</p><div class="item-strip">${chips(r.items)}</div><p class="small">三件为同局样本配装；已有散件不会自动当作成装。</p><div class="rec-divider"></div><h4>这局还要看什么</h4>${bullet(r.conditions)}<div class="rec-divider"></div><h4>成型阵容参考</h4><div class="combo-roster">${roster(r.comp.roster)}</div><p class="small">${r.comp.traits.slice(0,5).map(esc).join(' · ')}</p>${r.variant?`<p class="risk">原始名单不含${esc(r.hero)}，此搭配来自体系变体，暂不提供固定替换方案。</p>`:''}<p class="small">${absent.length?'未持有：'+absent.map(esc).join('、'):'参考名单中的英雄均已有来牌'}。终盘名单含高费补强，按人口分阶段补齐。</p><div class="rec-divider"></div><h4>投入与止损</h4><p>${esc(state.hp<40?'先用已有二星稳血，暂缓等待未到手的高费核心。':r.plan)}</p><label class="contest-row">该体系同行<select id="contest" data-cid="${r.compId}" aria-label="该阵容同行数量">${[0,1,2,3].map(n=>`<option value="${n}" ${Number(state.contested[r.compId]||0)===n?'selected':''}>${n===3?'3家及以上':n+'家'}</option>`).join('')}</select></label>${DATA.comps.some(c=>c.id===r.compId)?`<button class="plain combo-map-link" data-combo-map="${r.compId}">回到导图比较这条路线 →</button>`:''}<div class="rec-divider"></div><a href="${esc(r.comp.source)}" target="_blank" rel="noreferrer">查看原始体系 ↗</a><p class="small">${SYNERGIES.meta.patch} · 组合快照 ${SYNERGIES.meta.checked}。组合样本与原始阵容名单分开提供，不代表固定最优八人。</p></div></article>`;
 }
 function renderCombos(){
  const list=available();
  if(!list.some(i=>i.id===itemId)){itemId=list[0]?.id||null;routeKey=null;}
  $('#comboCatalog').innerHTML=list.map(i=>`<button class="combo-item ${i.id===itemId?'active':''}" data-combo-item="${i.id}" aria-pressed="${i.id===itemId}">${icon(i)}<span>${esc(i.name)}</span>${state.items[i.id]?`<b>已有 ${state.items[i.id]}</b>`:''}</button>`).join('')||'<p class="small combo-no-items">没有符合条件的装备。可以取消「只看已有」或修改搜索。</p>';
  const chosen=itemId?item(itemId):null;
  $('#comboItem').innerHTML=chosen?`<div class="combo-selected"><div class="combo-selected-name">${icon(chosen)}<div><span class="combo-kicker">${chosen.kind==='emblem'?'纹章定阵':'神器定阵'}</span><h3>${esc(chosen.name)}</h3></div></div><button class="${state.items[itemId]?'plain':'primary'}" id="ownComboItem" ${state.items[itemId]?'disabled':''}>${state.items[itemId]?'已计入开局 ×'+state.items[itemId]:'我已拥有，加入开局'}</button></div>`:'';
  const rows=itemId?comboRoutes(state,DATA,SYNERGIES,itemId,$('#comboSort').value):[];
  if(!rows.some(r=>key(r)===routeKey))routeKey=rows[0]?key(rows[0]):null;
  $('#comboResultCount').textContent=rows.length?`${rows.length} 条体系搭配 · ${rows.filter(r=>r.strong).length} 条样本表现较好`:'暂无组合样本';
  $('#comboResults').innerHTML=rows.map((r,i)=>`<button class="combo-route ${key(r)===routeKey?'active':''}" data-combo-route="${esc(key(r))}" aria-pressed="${key(r)===routeKey}"><div class="combo-route-path"><span class="combo-rank">${i+1}</span>${icon(lookup('heroes',r.hero))}<div><strong>${esc(r.hero)}</strong><small>${r.heroCount?'已有 '+r.heroCount+' 张':'尚未持有'}</small></div><span class="combo-arrow">→</span><div class="combo-route-name"><strong>${esc(r.comp.name)}</strong><small>${STYLE[r.style]} · ${r.variant?'变体参考':r.status}</small></div></div><div class="combo-route-stats"><span class="combo-strength ${r.strong?'strong':''}">${r.strong?'样本优选':r.samples<100||r.carrierSamples<50?'小样本，待验证':'谨慎备选'}</span><span>体系均次 <b>${r.avg.toFixed(2)}</b></span><span>前四 <b>${r.top4.toFixed(1)}%</b></span><span>${fmt(r.samples)} 样本</span></div><p>${esc(r.missing.length?r.conditions[0]:r.conditions.find(c=>c.includes('九五'))||r.conditions.find(c=>c.includes('血量'))||r.conditions[0])}</p><span class="combo-route-more">配套装备、阵容与缺失条件 ↗</span></button>`).join('')||`<div class="combo-empty"><h3>${chosen?'这件装备暂缺可用体系样本':'先选择一件装备'}</h3><p>${chosen?'可继续录入到开局，但当前不会编造携带者或给予强度加分。':'试试清空搜索或取消「只看已有」。'}</p></div>`;
  $('#comboFootnote').textContent=`${SYNERGIES.meta.patch} · 组合快照 ${SYNERGIES.meta.checked} · ${SYNERGIES.items.length}件装备 / ${SYNERGIES.comps.length}个体系。当前只比较数据源收录的常见搭配；前四率是成型样本统计，不是这局获胜概率。`;
  showInspector(rows.find(r=>key(r)===routeKey));
 }
 window.renderCombos=renderCombos;
 $('#mapTab').onclick=()=>show(false);
 $('#comboTab').onclick=()=>show(true);
 $('#comboSearch').addEventListener('input',()=>{routeKey=null;renderCombos();});
 for(const id of ['comboKind','comboOwned','comboSort'])$('#'+id).addEventListener('change',()=>{routeKey=null;renderCombos();});
 document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.openCombos!==undefined){show(true);$('#comboView').scrollIntoView({block:'nearest'});}
  if(b.dataset.comboItem){itemId=b.dataset.comboItem;routeKey=null;renderCombos();}
  if(b.dataset.comboRoute){routeKey=b.dataset.comboRoute;renderCombos();if(matchMedia('(max-width:1240px)').matches)$('#inspector').scrollIntoView({block:'start'});}
  if(b.id==='ownComboItem'&&itemId&&!state.items[itemId]){adjust('items',itemId,1);toast('已加入已有装备，推荐已更新');}
  if(b.dataset.comboMap){selectedId=b.dataset.comboMap;strategyId=null;show(false);}
 });
 $('#comboMethod').onclick=()=>showInfo('如何比较纹章与神器搭配',`<div class="info-copy"><p>先选一件装备，再看「携带英雄 → 体系阵容」。浏览不会把装备或英雄自动加入开局，只有「我已拥有」会录入该件装备。</p><h3>样本表现与本局条件分开看</h3><p>样本排序按平均名次向4.5名收缩（加入200个中性样本），再小幅参考与该体系总体名次的差值。数据源每件装备最多返回5条常见体系，不能覆盖所有玩法。样本优选需至少100个体系样本、50个携带者样本、体系均次不高于4.3、携带者均次不高于4.5，且低于该体系总体均次。</p><p>「结合我的开局」另看来牌、缺失纹章/神器、同行、高费路线的血量与经济门槛。高费终盘名次好，不等于前期开局就适合冲九五；小样本与冷门玩法可能低估。</p><h3>与开局导图联动</h3><p>已拥有且满足特殊装备条件的样本优选，会给已收录路线增加装备契合9分或纹章契合8分，各维度仍有原上限；必要纹章不重复加分。不因浏览推荐而添加任何英雄。同类特殊装备按最强一条计分，避免多件装备未分配就叠加强度。</p><h3>数据能说明什么</h3><p>统计描述共现和成型后的表现，不能证明某件装备造成胜率提升。配套三件装来自携带者样本；成型名单来自该体系的原始构筑。二者有差异时标为变体，不能直接照搬。版本变化后这份快照需要重新核对。</p><a href="https://www.dataj.cc/explorer" target="_blank" rel="noreferrer">金铲铲大数据 · 搭配探索 ↗</a></div>`);
 window.JCC.comboRoutes=(id,sort='fit')=>comboRoutes(state,DATA,SYNERGIES,id,sort);
})();
