// Version polling is isolated from game state and never rewrites the snapshot.
(() => {
 const PERIOD = 5 * 60 * 1000;
 const snapshotSeason = Number(DATA.meta.season.match(/^S(\d+)/)?.[1]);
 const live = document.getElementById('liveVersion');
 const snapshot = document.getElementById('snapshotVersion');
 const button = document.getElementById('checkVersionBtn');
 const notice = document.getElementById('versionNotice');
 const detail = document.getElementById('versionCheckDetail');
 let lastGood = null, lastCheck = null, inFlight = false, lastRequest = 0;
 snapshot.textContent = `阵容库 ${DATA.meta.patch} · ${DATA.meta.checked}`;
 const date = value => new Date(value).toLocaleString('zh-CN', {timeZone:'Asia/Shanghai',hour12:false,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
 function paint(status, message) {
  const latest = lastGood;
  const changed = latest && (latest.patch !== DATA.meta.patch || latest.seasonId !== snapshotSeason);
  document.body.classList.toggle('stale-data', Boolean(changed));
  notice.classList.toggle('outdated', Boolean(changed));
  live.textContent = latest ? `S${latest.seasonId} ${latest.seasonName} · 数据源 ${latest.patch}` : '数据源版本待核对';
  if(status==='offline'){
   notice.textContent='当前为文件预览。请使用「启动定阵导航.cmd」开启自动版本检查。';
   detail.textContent='文件预览不联网检查';return;
  }
  if(status==='checking'){
   notice.textContent=changed?`上次检测到 ${latest.patch}；推荐仍为 ${DATA.meta.patch}，正在重新核对…`:'正在核对数据源版本；当前推荐使用本地阵容库。';
   detail.textContent='正在检查…';return;
  }
  if(status==='error'){
   const previous=latest?`上次检测 ${latest.patch}（${date(lastCheck)}）。`:'';
   notice.textContent=`检查未成功。${previous}推荐仍基于 ${DATA.meta.patch}；${message}`;
   detail.textContent=lastCheck?`上次成功 ${date(lastCheck)} · 本次失败`:'检查失败 · 可重试';return;
  }
  detail.textContent=`${date(lastCheck)} 已检查 · 每5分钟复查`;
  if(changed){
   notice.textContent=`检测到 S${latest.seasonId} / ${latest.patch}。当前阵容库仍为 ${DATA.meta.patch}，以下仅作旧版参考，需要更新阵容数据。`;
  }else if(Date.parse(latest.dataUpdatedAt)>Date.parse(DATA.meta.updated)){
   notice.textContent=`版本仍为 ${latest.patch}；统计源已更新至 ${date(latest.dataUpdatedAt)}。主导图快照 ${DATA.meta.checked} · 组合快照 ${SYNERGIES.meta.checked}。`;
  }else{
   notice.textContent=`数据源与阵容库版本一致：${DATA.meta.patch}。阵容快照日期 ${DATA.meta.checked}。`;
  }
 }
 async function check(force=false) {
  if(inFlight)return;
  if(!['http:','https:'].includes(location.protocol)){paint('offline');button.disabled=true;return;}
  inFlight=true;lastRequest=Date.now();button.disabled=true;paint('checking');
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(), 15000);
  try {
   const response=await fetch(`/api/version${force?'?refresh=1':''}`, {cache:'no-store', signal:controller.signal});
   if(!response.ok)throw new Error('请通过新版启动脚本运行，或稍后重试。');
   const result=await response.json();
   const v=result.latest;
   if(v && Number.isInteger(v.seasonId) && typeof v.seasonName==='string' && v.seasonName.length<=50 && /^\d{1,2}\.\d{1,2}(?:\.?[a-z]{1,3})?$/.test(v.patch) && Number.isFinite(Date.parse(v.dataUpdatedAt)) && Number.isFinite(Date.parse(result.checkedAt))){
    lastGood=v;lastCheck=result.checkedAt;
   }else if(result.status==='ok')throw new Error('版本信息不完整，稍后重试。');
   if(result.status!=='ok')throw new Error('数据源暂不可用，稍后会重试。');
   paint('ok');
  }catch(e){paint('error',e.name==='AbortError'?'连接超时，稍后会重试。':e.message||'稍后会重试。');}
  finally{clearTimeout(timeout);inFlight=false;button.disabled=false;}
 }
 button.addEventListener('click',()=>check(true));
 check();
 setInterval(()=>{if(!document.hidden)check();},PERIOD);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastRequest>=PERIOD)check();});
 window.addEventListener('online',()=>check());
})();
