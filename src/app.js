const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lookup=(kind,id)=>DATA[kind].find(x=>x.id===id||x.name===id);
const icon=(row,cls='thumb')=>row?.img?`<img class="${cls}" src="${esc(row.img)}" alt="" loading="lazy">`:`<span class="fallback-thumb">${esc(row?.name?.slice(0,1)||'·')}</span>`;
let state=initialState(), selectedId=null, strategyId=null, assessment=null, pickerKind='heroes',pickerFilter='all',shot=null,ocrWorker=null,ocrBusy=false;
const aliases={'凯特琳':'女警','凯尔':'天使','卡兹克':'螳螂','黛安娜':'皎月','克格莫':'大嘴','厄斐琉斯':'月男','绯红树怪':'小红红buff','苍蓝哨戒':'小蓝蓝buff','希维尔':'轮子妈','索拉卡':'奶妈','卡西奥佩娅':'蛇女','奈德丽':'豹女','伊莉丝':'蜘蛛','乐芙兰':'妖姬','雷恩加尔':'狮子狗','深红锋喙鸟':'鸡哥','汲取剑':'饮血剑','鬼索的狂暴之刃':'羊刀','朔极之矛':'青龙刀','锐利之刃':'杀人剑','最后的轻语':'轻语','珠光护手':'法爆','班克斯的魔法帽':'帽子','无用大棒':'法棒','暴风之剑':'大剑','女神之泪':'水滴'};
const costs=['#a4b1c1','#7a9ba1','#41aa84','#5594de','#a974dc','#d5a243'];
const componentNames={'1001':'大剑','1002':'弓','1003':'法棒','1004':'水滴','1005':'护甲','1006':'斗篷','1007':'腰带','1009':'拳套'};
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),2800);}
function sourceFooter(){return `<div class="sources"><button class="text-btn" data-info="sources">数据与来源 ↗</button><p>18.2a · 数据更新于 2026-09-21<br>公开样本 + 可解释规则；版本变化后需重新核对。</p></div>`;}
function selectedRows(kind){
 const entries=kind==='augments'?state.augments.map(id=>[id,1]):Object.entries(state[kind]).filter(([id,n])=>n>0&&(kind!=='items'||!componentNames[id]));
 if(!entries.length)return `<p class="empty-input">${kind==='heroes'?'点击「添加」选择你已有的英雄':kind==='augments'?'未选；只添加已经拿下的海克斯':'成装、纹章还未录入'}</p>`;
 return entries.map(([id,n])=>{const row=lookup(kind,id);return `<div class="selected-row">${icon(row)}<span class="selected-name">${esc(row?.name||id)}</span>${kind==='augments'?`<button class="remove" aria-label="移除${esc(row.name)}" data-remove-aug="${id}">×</button>`:`<span class="counter"><button aria-label="减少${esc(row?.name)}" data-adjust="${kind}" data-key="${esc(id)}" data-delta="-1">−</button><b>${n}</b><button aria-label="增加${esc(row?.name)}" data-adjust="${kind}" data-key="${esc(id)}" data-delta="1">＋</button></span>`}</div>`}).join('');
}
function renderInputs(){
 $('#selectedHeroes').innerHTML=selectedRows('heroes');$('#selectedItems').innerHTML=selectedRows('items');$('#selectedAugments').innerHTML=selectedRows('augments');
 $('#componentGrid').innerHTML=Object.entries(componentNames).map(([id,name])=>{const row=lookup('items',id),n=state.items[id]||0;return `<button class="component-btn ${n?'active':''}" data-component="${id}" aria-label="添加${name}" title="${name}；点击加1，右键减1">${icon(row)}<span>${name}</span>${n?`<b>${n}</b>`:''}</button>`}).join('');
 // Component counts remain editable without relying on right-click (touch/keyboard).
 const comps=Object.entries(state.items).filter(([id,n])=>componentNames[id]&&n>0);
 if(comps.length){
  const componentRows=comps.map(([id,n])=>`<div class="selected-row"><span class="selected-name">${componentNames[id]}</span><span class="counter"><button aria-label="减少${componentNames[id]}" data-adjust="items" data-key="${id}" data-delta="-1">−</button><b>${n}</b><button aria-label="增加${componentNames[id]}" data-adjust="items" data-key="${id}" data-delta="1">＋</button></span></div>`).join('');
  $('#selectedItems').innerHTML=componentRows+(Object.entries(state.items).some(([id])=>!componentNames[id])?selectedRows('items'):'');
 }
 $('#inputCount').textContent=assessment.empty?'尚未录入':`${Object.keys(state.heroes).length}种英雄 · ${state.augments.length}个强化`;
}
function path(x1,y1,x2,y2){const m=(x1+x2)/2;return `M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2}`;}
function renderMap(){
 if(window.comboActive){window.renderCombos();return;}
 const top=assessment.results.slice(0,3);let chosen=assessment.results.find(c=>c.id===selectedId)||top[0];
 if(!top.some(c=>c.id===chosen.id))top[2]=chosen;
 selectedId=chosen.id;
 const strong=strategyId||STRATEGIES.reduce((best,s)=>chosen.parts[s.id]>chosen.parts[best]?s.id:best,'items');
 let svg='<svg class="map-svg" viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">';
 const ys=[70,196,322,448],cy=[104,270,436];
 STRATEGIES.forEach((s,i)=>{svg+=`<path class="edge ${s.id===strong&&!assessment.empty?'active':''}" d="${path(235,281,360,ys[i]+44)}"/>`;const target=s.id===strong?top.findIndex(c=>c.id===chosen.id):top.reduce((a,c,j)=>c.parts[s.id]>top[a].parts[s.id]?j:a,0);svg+=`<path class="edge ${s.id===strong&&!assessment.empty?'active':''}" d="${path(630,ys[i]+44,750,cy[target]+48)}"/>`;});
 svg+='</svg>';
 const root=`<div class="node root-node ${!assessment.empty?'active':''}"><strong>当前开局</strong><small>${assessment.empty?'选择英雄、装备<br>或上传截图':`${state.stage} · ${state.hp}血 · ${state.gold}金币<br>${Object.keys(state.heroes).length}种来牌 · ${state.level}级`}</small></div>`;
 const strategies=STRATEGIES.map((s,i)=>`<button class="node strategy-node ${s.id===strong&&!assessment.empty?'active':''}" style="top:${ys[i]}px" data-strategy="${s.id}" aria-pressed="${strategyId===s.id}"><strong>${s.name}</strong><small>${s.subtitle}</small>${assessment.empty?'':`<span class="strategy-value">所选阵容 ${chosen.parts[s.id]} / ${s.max}</span>`}</button>`).join('');
 const candidates=top.map((c,i)=>`<button class="node candidate-node ${c.id===selectedId&&!assessment.empty?'active':''}" style="top:${cy[i]}px" data-comp="${c.id}" ${assessment.empty?'disabled':''}><div class="candidate-top">${assessment.empty?'':icon(lookup('heroes',c.carry))}<strong>${assessment.empty?'等待开局信息':esc(c.name)}</strong></div><small>${assessment.empty?'输入后显示具体阵容':STYLE[c.style]+' · '+c.commitment}</small>${assessment.empty?'':`<div class="candidate-score"><span>开局匹配分</span><b>${c.score}</b></div>`}</button>`).join('');
 $('#mindmap').innerHTML=svg+'<span class="node-caption root-caption">输入</span><span class="node-caption strategy-caption">四种定阵策略</span><span class="node-caption candidate-caption">候选路线</span>'+root+strategies+candidates;
 $('#mapSubtitle').textContent=assessment.empty?'从左侧录入开局，看适合你的阵容分支':strategyId?`正在查看「${STRATEGIES.find(s=>s.id===strategyId).name}」；点击阵容看条件与下一步`:'点击阵容看依据；修改开局会重新比较所有路线';
 document.querySelectorAll('.step').forEach((e,i)=>e.classList.toggle('current',i===(assessment.phase<=2?(state.stage==='2-1'?0:1):2)));
 renderInspector(chosen,top);
}
function bullet(arr,empty='目前没有足够信息'){return `<ul>${arr.length?arr.map(x=>`<li>${esc(x)}</li>`).join(''):`<li class="reason-empty">${empty}</li>`}</ul>`;}
function renderInspector(c,top){
 if(assessment.empty){$('#inspector').innerHTML=`<h2>先看开局，再定阵</h2><div class="empty-inspector"><h3>给这局留两条路</h3><p>点选你已经拥有的英雄、装备与海克斯。导图会把来牌、装备和运营条件连到具体阵容。</p><span class="route-count">已收录 12 条当前版本路线</span><p style="margin-top:13px">也可以从示例开局开始，看看改变一个散件或几张核心牌，会让推荐如何变化。</p></div>${sourceFooter()}`;return;}
 const partCopy=STRATEGIES.map(s=>`<div class="part-bar"><label><span>${s.name}</span><span>${c.parts[s.id]} / ${s.max}</span></label><div class="bar-track"><i style="width:${c.parts[s.id]/s.max*100}%"></i></div></div>`).join('');
 $('#inspector').innerHTML=`<h2>${c.commitment==='可以围绕它投入'?'已有定阵依据':c.blocked.length?'先补齐必要条件':'先保留两条路线'}</h2><article class="recommendation"><div class="rec-head"><h3>${esc(c.name)}</h3><p>${STYLE[c.style]} · ${c.carry}主C · 匹配 ${c.score}分</p></div><div class="rec-body"><h4>为什么适合这局</h4>${bullet(c.reasons)}<div class="part-bars">${partCopy}</div><div class="rec-divider"></div><h4>还缺什么</h4>${bullet(c.gaps,'主要方向已经匹配，继续看同行和实际战力')}<div class="rec-divider"></div><h4>下一步</h4><p>${esc(c.action)}</p>${c.risks.length?`<p class="risk" style="margin-top:12px">${esc(c.risks.join('；'))}</p>`:''}<label class="contest-row">同主C的同行<select id="contest" data-cid="${c.id}" aria-label="该阵容同行数量">${[0,1,2,3].map(n=>`<option value="${n}" ${Number(state.contested[c.id]||0)===n?'selected':''}>${n===3?'3家及以上':n+'家'}</option>`).join('')}</select></label><div class="rec-divider"></div><h4>主C装备参考</h4><div class="item-strip">${c.items.map(id=>{const r=lookup('items',id);return `<span class="item-chip">${icon(r)}${esc(r?.name||id)}</span>`}).join('')}</div><button class="text-btn" style="margin-top:14px" data-details="${c.id}">查看成型阵容与过渡 →</button></div></article>${top.filter(a=>a.id!==c.id).slice(0,1).map(a=>`<button class="alt-card" data-comp="${a.id}"><strong>另一条路 · ${esc(a.name)}</strong><small>${STYLE[a.style]} · 匹配 ${a.score}分 · ${a.commitment}</small></button>`).join('')}${sourceFooter()}`;
}
function render(reset=false){assessment=evaluate(state,DATA,SYNERGIES);if(reset)selectedId=null;renderInputs();renderMap();}
function syncFields(){for(const k of ['stage','hp','gold','level','strength'])$('#'+k).value=state[k];$('#econ').checked=state.econ;}
function adjust(kind,key,delta){state[kind][key]=Math.max(0,Math.min(kind==='heroes'?9:12,(state[kind][key]||0)+delta));if(!state[kind][key])delete state[kind][key];render(true);}
function openPicker(kind,filter){pickerKind=kind;pickerFilter=filter||(kind==='items'?'full':'all');$('#pickerSearch').value='';$('#pickerTitle').textContent={heroes:'选择已有英雄',items:'选择已有装备',augments:'选择已选海克斯'}[kind];$('#pickerHelp').textContent=kind==='heroes'?'点击一次加入1张，回到开局后可调整数量。':kind==='augments'?'只录入已经选择的强化，最多3个。':'选择真实已有的成装、纹章、神器或散件。';renderPicker();$('#pickerDialog').showModal();$('#pickerSearch').focus();}
function renderPicker(){
 const q=$('#pickerSearch').value.trim().toLowerCase();
 const filters=pickerKind==='heroes'?[['all','全部'],...Array.from({length:5},(_,i)=>[String(i+1),(i+1)+'费'])]:pickerKind==='items'?[['component','散件'],['full','成装 / 特殊'],['emblem','纹章'],['artifact','神器'],['all','全部']]:[];
 $('#pickerFilters').innerHTML=filters.map(([id,name])=>`<button data-filter="${id}" class="${pickerFilter===id?'active':''}">${name}</button>`).join('');
 const rows=DATA[pickerKind].filter(r=>(r.name+(aliases[r.name]||'')).toLowerCase().includes(q)&&(pickerFilter==='all'||(pickerKind==='heroes'?String(r.cost)===pickerFilter:r.kind===pickerFilter)));
 $('#pickerGrid').innerHTML=rows.map(r=>{const count=pickerKind==='heroes'?state.heroes[r.name]:pickerKind==='items'?state.items[r.id]:state.augments.includes(r.id)?1:0;return `<button class="picker-card ${count?'selected':''}" data-pick="${r.id}" style="--cost:${costs[r.cost]||'#b9c8df'}" aria-label="${esc(r.name)}${count?' 已选'+count:''}">${icon(r)}<strong>${esc(r.name)}</strong>${r.cost?`<small>${r.cost}费</small>`:''}${count?`<b class="badge">${pickerKind==='augments'?'✓':count}</b>`:''}</button>`}).join('')||'<p class="small">没有找到，试试全名或常见昵称。</p>';
 $('#pickerStatus').textContent=`${rows.length}项 · ${pickerKind==='augments'?state.augments.length+'/3个强化':'点击即可加入'}`;
}
function showInfo(title,body){$('#infoTitle').textContent=title;$('#infoBody').innerHTML=body;$('#infoDialog').showModal();}
function showSources(){showInfo('数据与来源',`<div class="info-copy"><p>赛季：${DATA.meta.season}；数据源版本：${DATA.meta.patch}。抓取核对日：2026-09-21。原始更新时间：${new Date(DATA.meta.updated).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}（北京时间）。</p><p>阵容、出装、图鉴和强化共现来自<a href="https://www.dataj.cc/comp" target="_blank" rel="noreferrer">金铲铲大数据</a>的高分段样本。本工具的12条路线是候选池的一部分，并非全量阵容或实时榜单。</p><p>版本依据：<a href="${DATA.meta.patchSource}" target="_blank" rel="noreferrer">18.2a 9月17日更新公告（官方稿转载）</a>。9级、10级升级经验改动已回调；运营建议据此保留经济条件。</p><p>数据源共分析${DATA.meta.matches.toLocaleString()}局；阵容自己的样本数在详情里显示。成型阵容数据带有选择偏差，不能当作从当前开局走过去的获胜概率。</p><p>头像、装备和强化图标来自腾讯游戏静态资源。仅用于个人攻略研究。截图文字识别使用本地 Tesseract.js；不会上传截图。</p><p>页面每5分钟检查数据源当前版本，顶部同时显示最新检测结果与本地阵容库版本。版本源可能晚于官方公告；阵容库仍为静态快照，不会随版本号自动替换。进入其他赛季或新补丁后，需先更新阵容池。</p></div>`);}
function showLogic(){showInfo('定阵规则，可检查也可调整',`<div class="info-copy"><p>先检查硬条件，再比较契合度，最后决定投入程度。这是基于公开数据的规则推断，尚未用真实对局回测。</p><table><thead><tr><th>维度</th><th>上限</th><th>判断依据</th></tr></thead><tbody><tr><td>装备定向</td><td>30</td><td>主C推荐成装优先，散件只表示方向；有样本支持的神器搭配增加装备契合度。</td></tr><tr><td>来牌定阵</td><td>30</td><td>主C总张数、核心来牌、与常见4人口过渡阵容的重合。</td></tr><tr><td>强化与纹章</td><td>20</td><td>已拿强化与阵容的共现关联；特定纹章作为硬条件；已核验的纹章搭配可补充契合度。</td></tr><tr><td>经济运营</td><td>12</td><td>按阶段、金币、血量、场面与额外经济，区分追三/速八/九五。</td></tr><tr><td>样本表现</td><td>8</td><td>当前样本平均排名，小样本降权。</td></tr></tbody></table><h3>什么时候可以定阵？</h3><p>至少两类信号同时达标、总分达到52、硬条件齐全；追三还需主C至少3张、同行少于2家。以上阈值是本工具的可解释启发式，不是官方规则或成功率。</p><h3>什么时候保留后手？</h3><p>单一强信号不足以锁阵；低血优先稳血；二阶段九五只作远期候选。追三每家同行扣9分，其他路线每家扣5分。具体数值待实战校准。</p><h3>纹章与神器搭配</h3><p>新增21种纹章、24件神器的137条携带者与体系组合，组合样本核对日为2026-09-23。导图中的主阵容库仍是9月21日快照；组合页单独展示19个体系的参考构筑。已拥有且条件齐全的样本优选才影响导图，具体门槛见组合页「排序依据」。</p><h3>截图输入的边界</h3><p>当前识别器读取截图中的文字并匹配名称，不具备可靠的棋子模型、头像、星级、归属判断能力。因此先生成待校对候选，不自动认定商店卡或海克斯选项已经拥有。没有文字的单位请用点选补充。</p></div>`);}
function showDetails(id){const c=assessment.results.find(c=>c.id===id);showInfo(c.name,`<div class="info-copy"><p>${STYLE[c.style]} · ${c.role} · ${c.commitment}</p><h3>成型阵容参考</h3><div class="mini-roster">${c.roster.map(n=>`<div class="roster-unit">${icon(lookup('heroes',n))}<span title="${esc(n)}">${esc(n)}</span></div>`).join('')}</div><p>${c.roster.map(esc).join('、')}</p><p class="small">终盘参考包含后期高费补强；当前等级上不满时先围绕二星核心过渡。强化、转职和实际来牌会改变最终人数与构筑。</p><h3>样本中的4人口过渡</h3>${c.early.length?c.early.map((ns,i)=>`<p>${i+1}. ${ns.map(esc).join('、')}</p>`).join(''):'<p>此阵容没有可用的前期样本。</p>'}<h3>投入与止损</h3><p>${esc(c.plan)}</p>${bullet(c.risks,'继续观察装备、同行与核心来牌')}<h3>来源快照</h3><p>${c.samples.toLocaleString()}个阵容样本 · 平均排名${c.avg} · 数据源评级${c.tier}。这是成型样本表现，不是你的预期名次。</p><a href="${c.source}" target="_blank" rel="noreferrer">查看原始阵容与统计 ↗</a></div>`);}
function showPool(){showInfo('全部候选路线',`<p class="small" style="margin-bottom:15px">按当前开局匹配排序；条件不齐的路线仍可查看原因。</p><div class="pool-list">${assessment.results.map(c=>`<button class="pool-row" data-pool-select="${c.id}"><b>${esc(c.name)}</b><small>${assessment.empty?'未录入开局':c.score+'分'}</small><span>${STYLE[c.style]} · ${c.commitment} · ${c.blocked.join(' / ')||c.role}</span></button>`).join('')}</div>`);}
function usePreset(name){state=initialState();if(name==='cait'){Object.assign(state,{stage:'2-5',gold:25,level:5});state.heroes={'凯特琳':4,'伊莉丝':3,'洛':3};state.items={'1001':1,'1002':2,'1003':1};}if(name==='kayle'){Object.assign(state,{stage:'3-2',gold:42,level:6});state.heroes={'凯尔':5,'霞':3,'奥恩':3,'蕾欧娜':3};state.items={'2010':1,'2038':1,'1005':1};}if(name==='red'){Object.assign(state,{stage:'2-5',gold:24,level:4});state.heroes={'绯红树怪':5,'苍蓝哨戒':3,'峡谷迅捷蟹':2};state.items={'2001':1,'1001':1,'1004':1};}if(name==='inferno'){Object.assign(state,{stage:'3-2',gold:48,hp:92,level:6,strength:'strong',econ:true});state.heroes={'慎':3,'韦鲁斯':3,'蔚':2,'希维尔':1};state.items={'41806':1,'2004':1,'1002':2};}if(name==='danger'){Object.assign(state,{stage:'4-2',gold:16,hp:29,level:7,strength:'weak'});state.heroes={'希维尔':1,'蔚':3,'阿木木':1};state.items={'2001':1,'41806':1,'2004':1};}syncFields();render(true);toast('已载入示例，请按你的真实开局修改');}

function buildCandidates(){const m=matchText($('#ocrText').value,DATA);let count=0;$('#ocrCandidates').innerHTML=['heroes','items','augments'].map(kind=>{if(!m[kind].length)return '';count+=m[kind].length;return `<h4>${{heroes:'英雄候选',items:'装备候选',augments:'强化候选'}[kind]}</h4>`+m[kind].map(r=>`<label class="ocr-candidate"><input type="checkbox" data-ocr-kind="${kind}" data-ocr-id="${esc(r.id)}">${icon(r)}<span>${esc(r.name)}</span>${kind==='augments'?'':`<input type="number" aria-label="${esc(r.name)}确认数量" value="1" min="1" max="${kind==='heroes'?9:12}">`}</label>`).join('')}).join('')||'<p class="small">没有匹配到名称。可以修正识别文字，或回到点选录入。</p>';$('#applyOcr').disabled=!count;}
async function loadOCR(){if(window.Tesseract)return;await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='vendor/tesseract.min.js';script.onload=resolve;script.onerror=()=>reject(new Error('本地识别组件未加载，请通过启动脚本打开页面。'));document.head.appendChild(script);});}
async function recognize(){
 if(!shot||ocrBusy)return;ocrBusy=true;$('#ocrBtn').disabled=true;$('#clearShot').disabled=true;$('#screenshotFile').disabled=true;
 let timer;try{
  $('#ocrStatus').textContent='正在启动本地文字识别…';await loadOCR();
  const task=(async()=>{ocrWorker=await Tesseract.createWorker(['chi_sim','eng'],1,{workerPath:new URL('vendor/worker.min.js',location.href).href,corePath:new URL('vendor/core/',location.href).href,langPath:new URL('vendor/lang/',location.href).href,logger:m=>{if(m.status==='recognizing text')$('#ocrStatus').textContent=`识别截图文字 ${Math.round(m.progress*100)}%`;}});await ocrWorker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'});const r=await ocrWorker.recognize(shot);return r.data;})();
  const result=await Promise.race([task,new Promise((_,reject)=>timer=setTimeout(()=>reject(new Error('识别超时，请裁剪到有文字的区域后重试，或直接点选。')),90000))]);
  $('#ocrText').value=result.text;buildCandidates();$('#ocrStatus').textContent='文字识别完成。请确认归属和数量后再加入；未匹配的头像用点选补齐。';
 }catch(e){$('#ocrStatus').textContent=e.message||'识别失败，可手动录入。';}
 finally{clearTimeout(timer);if(ocrWorker){await ocrWorker.terminate().catch(()=>{});ocrWorker=null;}ocrBusy=false;$('#ocrBtn').disabled=!shot;$('#clearShot').disabled=false;$('#screenshotFile').disabled=false;}
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.close){$('#'+b.dataset.close).close();return;}
 if(b.dataset.picker){openPicker(b.dataset.picker,b.dataset.pickerFilter);return;}
 if(b.dataset.adjust){adjust(b.dataset.adjust,b.dataset.key,Number(b.dataset.delta));return;}
 if(b.dataset.component){adjust('items',b.dataset.component,1);return;}
 if(b.dataset.removeAug){state.augments=state.augments.filter(id=>id!==b.dataset.removeAug);render(true);return;}
 if(b.dataset.comp){selectedId=b.dataset.comp;renderMap();return;}
 if(b.dataset.strategy){strategyId=strategyId===b.dataset.strategy?null:b.dataset.strategy;renderMap();return;}
 if(b.dataset.info==='sources'){showSources();return;}
 if(b.dataset.details){showDetails(b.dataset.details);return;}
 if(b.dataset.filter){pickerFilter=b.dataset.filter;renderPicker();return;}
 if(b.dataset.pick){const row=lookup(pickerKind,b.dataset.pick);if(pickerKind==='augments'){if(state.augments.includes(row.id))state.augments=state.augments.filter(id=>id!==row.id);else if(state.augments.length<3)state.augments.push(row.id);else toast('最多录入3个已选海克斯');render(true);}else adjust(pickerKind,pickerKind==='heroes'?row.name:row.id,1);renderPicker();return;}
 if(b.dataset.poolSelect){selectedId=b.dataset.poolSelect;$('#infoDialog').close();if(!assessment.empty)renderMap();else showDetails(selectedId);return;}
});
$('#componentGrid').addEventListener('contextmenu',e=>{const b=e.target.closest('[data-component]');if(b){e.preventDefault();adjust('items',b.dataset.component,-1);}});
document.addEventListener('change',e=>{if(e.target.id==='contest'){state.contested[e.target.dataset.cid]=Number(e.target.value);render();}});
for(const k of ['stage','hp','gold','level','strength'])$('#'+k).addEventListener('change',e=>{state[k]=['hp','gold','level'].includes(k)?Math.max(Number(e.target.min||0),Math.min(Number(e.target.max||200),Number(e.target.value)||0)):e.target.value;syncFields();render(true);});
$('#econ').addEventListener('change',e=>{state.econ=e.target.checked;render(true);});
$('#preset').addEventListener('change',e=>{if(e.target.value)usePreset(e.target.value);});
$('#resetBtn').onclick=()=>{state=initialState();selectedId=null;strategyId=null;$('#preset').value='';syncFields();render();toast('已清空开局');};
$('#allStrategies').onclick=()=>{strategyId=null;renderMap();};
$('#logicBtn').onclick=showLogic;$('#poolBtn').onclick=showPool;
$('#pickerSearch').addEventListener('input',renderPicker);
$('#uploadBtn').onclick=()=>$('#screenshotDialog').showModal();
$('#screenshotFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(!['image/png','image/jpeg','image/webp'].includes(f.type)){toast('请选择 PNG、JPG 或 WebP 图片');return;}if(f.size>20*1024*1024){toast('图片超过20MB，请使用较小截图');return;}if(shot)URL.revokeObjectURL(shot);shot=URL.createObjectURL(f);$('#shotPreview').src=shot;$('#shotPreview').hidden=false;$('#ocrBtn').disabled=false;$('#ocrText').value='';$('#ocrCandidates').innerHTML='<p class="small">点击识别，再校对名称与归属。</p>';$('#applyOcr').disabled=true;$('#ocrStatus').textContent='图片已加载，可识别其中的文字。';};
$('#clearShot').onclick=()=>{if(shot)URL.revokeObjectURL(shot);shot=null;$('#shotPreview').hidden=true;$('#shotPreview').removeAttribute('src');$('#screenshotFile').value='';$('#ocrText').value='';$('#ocrCandidates').innerHTML='';$('#applyOcr').disabled=true;$('#ocrBtn').disabled=true;$('#ocrStatus').textContent='建议截图中包含英雄、装备或海克斯名称。';};
$('#ocrBtn').onclick=recognize;$('#matchTextBtn').onclick=buildCandidates;
$('#applyOcr').onclick=()=>{let added=0;document.querySelectorAll('[data-ocr-kind]:checked').forEach(input=>{const kind=input.dataset.ocrKind,row=lookup(kind,input.dataset.ocrId);if(kind==='augments'){if(!state.augments.includes(row.id)&&state.augments.length<3){state.augments.push(row.id);added++;}}else{const max=kind==='heroes'?9:12;const n=Math.max(1,Math.min(max,Number(input.closest('label').querySelector('input[type=number]').value)||1));const key=kind==='heroes'?row.name:row.id;state[kind][key]=Math.min(max,(state[kind][key]||0)+n);added++;}});if(!added){toast('请先勾选你确认已拥有的内容（海克斯最多3个）');return;}$('#screenshotDialog').close();render(true);toast(`已加入${added}项，请复核开局数量`);};
syncFields();render();
window.JCC={getState:()=>structuredClone(state),evaluate:s=>evaluate(s,DATA,SYNERGIES),data:DATA,matchText:t=>matchText(t,DATA)};
