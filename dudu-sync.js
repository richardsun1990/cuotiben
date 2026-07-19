(function(){
  'use strict';

  const WATCH_KEYS=[
    'cuoti_v3',
    'dudu_math_activity_v1',
    'dudu_vocab_v2',
    'dudu_vocab_history_v2',
    'dudu_vocab_daily_v1',
    'dudu_vocab_settings_v1',
    'dudu_user_profile_v1',
    'dudu_activity_log_v1'
  ];
  const CONFIG_KEY='dudu_sync_config_v1';
  const STATE_KEY='dudu_sync_state_v1';
  const DEFAULT_CONFIG={enabled:false,apiBase:'',token:'',autoPull:true,autoPush:true};
  let suppress=false,pushTimer=null;

  function safeJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
  function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value))}
  function notify(message){if(typeof window.toast==='function')window.toast(message);else console.log(message)}
  function sameOriginApiBase(){return location.protocol.startsWith('http')&&!/github\.io$/i.test(location.hostname)?location.origin:''}
  function getConfig(){return {...DEFAULT_CONFIG,apiBase:sameOriginApiBase(),...safeJson(CONFIG_KEY,{})}}
  function getState(){return {deviceId:getDeviceId(),lastRemoteUpdatedAt:0,...safeJson(STATE_KEY,{})}}
  function saveState(next){writeJson(STATE_KEY,{...getState(),...next})}
  function getDeviceId(){
    const state=safeJson(STATE_KEY,null);
    if(state?.deviceId)return state.deviceId;
    const id='device-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
    writeJson(STATE_KEY,{deviceId:id,lastRemoteUpdatedAt:0});return id;
  }
  function apiBase(){
    const raw=(getConfig().apiBase||sameOriginApiBase()||'').trim().replace(/\/+$/,'');
    return raw;
  }
  function snapshot(){
    const data={};
    WATCH_KEYS.forEach(key=>{data[key]=localStorage.getItem(key)});
    return data;
  }
  function restore(data){
    let changed=false;
    suppress=true;
    try{
      WATCH_KEYS.forEach(key=>{
        if(!Object.prototype.hasOwnProperty.call(data,key))return;
        const value=data[key];
        const before=localStorage.getItem(key);
        if(value===null){if(before!==null){localStorage.removeItem(key);changed=true}}
        else if(typeof value==='string'&&before!==value){localStorage.setItem(key,value);changed=true}
      });
    }finally{suppress=false}
    return changed;
  }
  function authHeaders(){
    const token=(getConfig().token||'').trim();
    return token?{authorization:'Bearer '+token}:{};
  }
  async function request(path,options={}){
    const base=apiBase();
    if(!base)throw new Error('请先填写飞牛同步地址');
    const response=await fetch(base+path,{
      ...options,
      headers:{'content-type':'application/json',...authHeaders(),...(options.headers||{})}
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(data.error||'飞牛同步请求失败');error.status=response.status;error.data=data;throw error}
    return data;
  }
  function setStatus(text,type){
    const el=document.getElementById('duduSyncStatus');
    if(!el)return;
    el.textContent=text;
    el.dataset.type=type||'';
  }
  async function testSync(){
    const store=await request('/api/sync',{method:'GET'});
    saveState({lastRemoteUpdatedAt:Number(store.updatedAt)||0});
    setStatus(store.updatedAt?'连接成功，飞牛上已有同步数据':'连接成功，飞牛上暂时没有数据','ok');
    notify('飞牛同步连接成功');
  }
  async function pullSync(options={}){
    const store=await request('/api/sync',{method:'GET'});
    const remoteUpdatedAt=Number(store.updatedAt)||0;
    if(!remoteUpdatedAt){
      setStatus('飞牛上暂时没有数据，可以先点“同步到飞牛”','ok');
      return false;
    }
    const state=getState();
    if(options.onlyIfNewer&&remoteUpdatedAt<=Number(state.lastRemoteUpdatedAt||0))return false;
    const changed=restore(store.data||{});
    saveState({lastRemoteUpdatedAt:remoteUpdatedAt,lastPulledAt:Date.now()});
    if(changed){
      setStatus('已从飞牛拉取数据，正在刷新页面','ok');
      notify('已从飞牛拉取数据');
      setTimeout(()=>location.reload(),700);
    }else{
      setStatus('本机数据已经是最新','ok');
    }
    return changed;
  }
  async function pushSync(options={}){
    const state=getState();
    try{
      const store=await request('/api/sync',{
        method:'PUT',
        body:JSON.stringify({
          deviceId:state.deviceId,
          baseUpdatedAt:Number(state.lastRemoteUpdatedAt||0),
          force:!!options.force,
          data:snapshot()
        })
      });
      saveState({lastRemoteUpdatedAt:Number(store.updatedAt)||0,lastPushedAt:Date.now()});
      setStatus('已同步到飞牛','ok');
      return true;
    }catch(error){
      if(error.status===409){
        setStatus('飞牛上有更新，请先点“从飞牛拉取”','warn');
        notify('飞牛上有更新，请先拉取再同步');
        return false;
      }
      setStatus(error.message||'同步失败','error');
      throw error;
    }
  }
  function schedulePush(){
    const config=getConfig();
    if(!config.enabled||!config.autoPush||suppress)return;
    clearTimeout(pushTimer);
    pushTimer=setTimeout(()=>pushSync().catch(()=>{}),1200);
  }
  function patchStorage(){
    if(Storage.prototype.__duduSyncPatched)return;
    const setItem=Storage.prototype.setItem,removeItem=Storage.prototype.removeItem;
    Storage.prototype.setItem=function(key,value){
      const watched=this===localStorage&&WATCH_KEYS.includes(String(key));
      const before=watched?this.getItem(key):null;
      const result=setItem.apply(this,arguments);
      if(watched&&before!==String(value))schedulePush();
      return result;
    };
    Storage.prototype.removeItem=function(key){
      const watched=this===localStorage&&WATCH_KEYS.includes(String(key));
      const before=watched?this.getItem(key):null;
      const result=removeItem.apply(this,arguments);
      if(watched&&before!==null)schedulePush();
      return result;
    };
    Storage.prototype.__duduSyncPatched=true;
  }
  function style(){
    if(document.getElementById('duduSyncStyle'))return;
    const el=document.createElement('style');
    el.id='duduSyncStyle';
    el.textContent='.dudu-sync-panel{border:1px solid #ececf5;border-radius:18px;padding:16px;background:#fbfbff;display:grid;gap:12px}.dudu-sync-panel h3{margin:0;font-size:16px}.dudu-sync-panel p{margin:0;color:#667085;font-size:13px;line-height:1.6}.dudu-sync-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.dudu-sync-grid label,.dudu-sync-panel label{font-size:13px;color:#475467}.dudu-sync-grid input{width:100%;box-sizing:border-box;margin-top:6px}.dudu-sync-checks{display:flex;flex-wrap:wrap;gap:10px}.dudu-sync-checks label{display:flex;align-items:center;gap:6px;background:white;border:1px solid #ececf5;border-radius:999px;padding:8px 10px}.dudu-sync-actions{display:flex;flex-wrap:wrap;gap:8px}.dudu-sync-actions button{border:0;border-radius:999px;padding:10px 14px;background:#6c5ce7;color:white;font-weight:700}.dudu-sync-actions button.secondary{background:white;color:#344054;border:1px solid #d0d5dd}.dudu-sync-status{font-size:13px;color:#667085}.dudu-sync-status[data-type=ok]{color:#15936d}.dudu-sync-status[data-type=warn]{color:#b76e00}.dudu-sync-status[data-type=error]{color:#c0362c}@media(max-width:720px){.dudu-sync-grid{grid-template-columns:1fr}}';
    document.head.appendChild(el);
  }
  function injectPanel(){
    const modal=document.querySelector('.profile-body');
    if(!modal||document.getElementById('duduSyncPanel'))return;
    style();
    const config=getConfig();
    const panel=document.createElement('section');
    panel.id='duduSyncPanel';
    panel.className='dudu-sync-panel';
    panel.innerHTML='<div><h3>飞牛同步</h3><p>把数学错题、英语单词和学习记录同步到飞牛服务器。第一台设备先“同步到飞牛”，其他设备再“从飞牛拉取”。</p></div><div class="dudu-sync-grid"><label>同步地址<input id="duduSyncApiBase" placeholder="http://192.168.3.xxx:8787"></label><label>同步口令<input id="duduSyncToken" placeholder="例如 dudu-local-sync" type="password"></label></div><div class="dudu-sync-checks"><label><input id="duduSyncEnabled" type="checkbox">启用同步</label><label><input id="duduSyncAutoPull" type="checkbox">打开时自动拉取</label><label><input id="duduSyncAutoPush" type="checkbox">修改后自动同步</label></div><div class="dudu-sync-actions"><button type="button" onclick="saveDuduSyncConfig()">保存设置</button><button class="secondary" type="button" onclick="testDuduSync()">测试连接</button><button class="secondary" type="button" onclick="pullDuduSync()">从飞牛拉取</button><button type="button" onclick="pushDuduSync()">同步到飞牛</button></div><div class="dudu-sync-status" id="duduSyncStatus">尚未连接飞牛服务器</div>';
    modal.insertBefore(panel,modal.querySelector('.profile-save'));
    document.getElementById('duduSyncApiBase').value=config.apiBase||'';
    document.getElementById('duduSyncToken').value=config.token||'';
    document.getElementById('duduSyncEnabled').checked=!!config.enabled;
    document.getElementById('duduSyncAutoPull').checked=!!config.autoPull;
    document.getElementById('duduSyncAutoPush').checked=!!config.autoPush;
  }
  function patchProfile(){
    const original=window.openProfileSettings;
    if(typeof original!=='function'||original.__duduSync)return;
    window.openProfileSettings=function(){
      const result=original.apply(this,arguments);
      setTimeout(injectPanel,0);
      return result;
    };
    window.openProfileSettings.__duduSync=true;
  }
  window.saveDuduSyncConfig=function(){
    const config={
      enabled:document.getElementById('duduSyncEnabled')?.checked||false,
      apiBase:(document.getElementById('duduSyncApiBase')?.value||'').trim().replace(/\/+$/,''),
      token:document.getElementById('duduSyncToken')?.value||'',
      autoPull:document.getElementById('duduSyncAutoPull')?.checked!==false,
      autoPush:document.getElementById('duduSyncAutoPush')?.checked!==false
    };
    writeJson(CONFIG_KEY,config);
    setStatus('同步设置已保存','ok');
    notify('飞牛同步设置已保存');
  };
  window.testDuduSync=()=>testSync().catch(error=>setStatus(error.message||'连接失败','error'));
  window.pullDuduSync=()=>pullSync().catch(error=>setStatus(error.message||'拉取失败','error'));
  window.pushDuduSync=()=>pushSync({force:false}).catch(error=>setStatus(error.message||'同步失败','error'));

  function init(){
    patchStorage();
    patchProfile();
    const config=getConfig();
    if(config.enabled&&config.autoPull){
      setTimeout(()=>pullSync({onlyIfNewer:true}).catch(()=>{}),500);
    }
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')schedulePush()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
