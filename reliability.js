(function(){
'use strict';

const KEYS={
  math:'cuoti_v3',words:'dudu_vocab_v2',history:'dudu_vocab_history_v2',daily:'dudu_vocab_daily_v1',settings:'dudu_vocab_settings_v1',
  profile:'dudu_user_profile_v1',mathActivity:'dudu_math_activity_v1',activity:'dudu_activity_log_v1',backup:'dudu_last_backup_at_v1'
};
const DAY=86400000;
const safe=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch(error){console.error(error);notify('保存失败，请先导出完整备份并清理浏览器空间');return false}};
const escapeHtml=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function notify(text){if(typeof window.toast==='function')window.toast(text);else alert(text)}
function epochDay(time=Date.now()){return Math.floor(time/DAY)}
function download(payload,name){const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),800)}
function storageBytes(){return Object.values(KEYS).reduce((sum,key)=>sum+(localStorage.getItem(key)||'').length*2,0)}
function storageText(){const kb=storageBytes()/1024;return kb<1024?`${Math.round(kb)} KB`:`${(kb/1024).toFixed(1)} MB`}

function logActivity(type,text,count=1,meta={}){
  const list=safe(KEYS.activity,[]);
  list.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2),type,text,count:Math.max(1,Number(count)||1),at:Date.now(),...meta});
  write(KEYS.activity,list.slice(-1200));
}
window.logDuduActivity=logActivity;

function migrateMath(){
  const list=safe(KEYS.math,[]);if(!Array.isArray(list))return;
  let changed=false;
  list.forEach(q=>{if('ansImg' in q){delete q.ansImg;changed=true}if(q.lastReviewedAt===undefined)q.lastReviewedAt=null});
  if(changed)write(KEYS.math,list);
}
function repairEnglishDaily(){
  const wordList=safe(KEYS.words,[]),daily=safe(KEYS.daily,{});if(!Array.isArray(wordList)||!daily||typeof daily!=='object')return;
  const counts={};wordList.forEach(word=>{if(word.introducedDay!=null)counts[String(word.introducedDay)]=(counts[String(word.introducedDay)]||0)+1});
  Object.keys(daily).forEach(key=>{daily[key]={activities:0,correct:0,sessions:0,...(daily[key]||{}),newWords:counts[key]||0}});
  Object.entries(counts).forEach(([key,count])=>{if(!daily[key])daily[key]={activities:0,correct:0,sessions:0,newWords:count};else daily[key].newWords=count});
  write(KEYS.daily,daily);
}

window.exportAllDuduData=function(){
  repairEnglishDaily();
  const payload={app:'dudu-cuotuiben',version:2,type:'complete',exportedAt:new Date().toISOString(),data:{}};
  Object.entries(KEYS).forEach(([name,key])=>{if(name!=='backup')payload.data[key]=safe(key,null)});
  download(payload,`dudu-complete-backup-${new Date().toISOString().slice(0,10)}.json`);
  localStorage.setItem(KEYS.backup,new Date().toISOString());updateBackupText();notify('完整备份已导出');
};
window.importAllDuduData=async function(input){
  const file=input?.files?.[0];if(!file)return;
  try{
    if(file.size>40*1024*1024)throw new Error('备份文件超过 40MB，无法安全恢复');
    const payload=JSON.parse(await file.text());
    if(payload?.app!=='dudu-cuotuiben'||payload?.type!=='complete'||!payload.data)throw new Error('不是嘟嘟错题本完整备份');
    if(!confirm('恢复完整备份会覆盖当前数学、英语、资料和学习记录，确定继续吗？'))return;
    Object.entries(payload.data).forEach(([key,value])=>{if(Object.values(KEYS).includes(key)&&key!==KEYS.backup){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(value))}});
    localStorage.setItem(KEYS.backup,new Date().toISOString());location.reload();
  }catch(error){notify(error.message||'完整备份导入失败')}finally{input.value=''}
};
window.clearAllDuduData=function(){
  if(!confirm('确定清空全部数学错题、英语单词和学习记录吗？'))return;
  if(!confirm('此操作无法撤销。建议先导出完整备份，再次确认清空？'))return;
  Object.values(KEYS).forEach(key=>localStorage.removeItem(key));location.reload();
};
function updateBackupText(){
  const el=document.getElementById('lastBackupText'),value=localStorage.getItem(KEYS.backup);if(!el)return;
  el.textContent=`当前占用 ${storageText()} · ${value?`上次备份 ${new Date(value).toLocaleString('zh-CN')}`:'尚未完整备份'}`;
}
function injectBackupManager(){
  const modal=document.querySelector('.profile-body');if(!modal||modal.querySelector('.complete-backup'))return;
  const box=document.createElement('section');box.className='complete-backup';
  box.innerHTML=`<div><b>完整数据备份</b><span id="lastBackupText"></span></div><div class="backup-actions"><button type="button" onclick="exportAllDuduData()">导出全部数据</button><label>恢复全部数据<input type="file" accept=".json,application/json" onchange="importAllDuduData(this)"></label></div><button class="clear-all-data" type="button" onclick="clearAllDuduData()">清空全部学习数据</button><p>完整备份包含数学错题、英语单词、学习记录、昵称、年级和学习目标。</p>`;
  modal.insertBefore(box,modal.querySelector('.profile-save'));updateBackupText();
}

function snackbar(message,undo){
  let bar=document.getElementById('undoBar');if(!bar){bar=document.createElement('div');bar.id='undoBar';bar.className='undo-bar';document.body.appendChild(bar)}
  bar.innerHTML=`<span>${escapeHtml(message)}</span><button type="button">撤销</button>`;bar.classList.add('show');
  bar.querySelector('button').onclick=()=>{undo();bar.classList.remove('show')};clearTimeout(bar._timer);bar._timer=setTimeout(()=>bar.classList.remove('show'),10000);
}
function wrapDelete(name,key,label){
  const original=window[name];if(typeof original!=='function'||original.__undo)return;
  const wrapped=function(...args){
    const before=localStorage.getItem(key),oldConfirm=window.confirm;let confirmed=false;
    window.confirm=message=>{const answer=oldConfirm(message);if(answer)confirmed=true;return answer};
    try{
      const result=original.apply(this,args);
      setTimeout(()=>{if(confirmed&&before!==localStorage.getItem(key)){snackbar(`${label}已删除`,()=>{if(before===null)localStorage.removeItem(key);else localStorage.setItem(key,before);location.reload()})}},0);
      return result;
    }finally{window.confirm=oldConfirm}
  };
  wrapped.__undo=true;window[name]=wrapped;
}
function wrapActivity(name,type,text){
  const original=window[name];if(typeof original!=='function'||original.__activity)return;
  const wrapped=function(...args){const before=localStorage.getItem(KEYS.math),result=original.apply(this,args);setTimeout(()=>{if(before!==localStorage.getItem(KEYS.math))logActivity(type,text)},0);return result};
  wrapped.__activity=true;window[name]=wrapped;
}
function wrapWordAdd(name,label){
  const original=window[name];if(typeof original!=='function'||original.__activity)return;
  const wrapped=function(...args){const before=safe(KEYS.words,[]).length,result=original.apply(this,args);Promise.resolve(result).finally(()=>setTimeout(()=>{const after=safe(KEYS.words,[]).length;if(after>before)logActivity('english-add',`${label} ${after-before} 个单词`,after-before)},0));return result};
  wrapped.__activity=true;window[name]=wrapped;
}

function patchEnglishNewWordFlow(){
  const originalWordsForMode=window.wordsForMode;
  if(typeof originalWordsForMode==='function'&&!originalWordsForMode.__unique){
    const replacement=function(mode){if(mode==='new')return typeof newWordsPreview==='function'?newWordsPreview():[];return originalWordsForMode(mode)};
    replacement.__unique=true;window.wordsForMode=replacement;
  }
  const originalSummary=window.showSummary;
  if(typeof originalSummary==='function'&&!originalSummary.__unique){
    const replacement=function(...args){const result=originalSummary.apply(this,args);try{const record=typeof todayRecord==='function'?todayRecord():null;if(record&&typeof words!=='undefined'&&typeof day==='function'){record.newWords=words.filter(word=>word.introducedDay===day()).length;if(typeof persist==='function')persist()}window.refreshLearningStats?.()}catch(error){console.error(error)}return result};
    replacement.__unique=true;window.showSummary=replacement;
  }
}

function openWordEdit(word){
  const list=safe(KEYS.words,[]),item=list.find(entry=>entry.word===word);if(!item)return;
  let overlay=document.getElementById('wordEditOverlay');
  if(!overlay){
    overlay=document.createElement('div');overlay.id='wordEditOverlay';overlay.className='overlay word-edit-overlay';
    overlay.innerHTML='<section class="modal"><header><div><h2>编辑英语单词</h2><p>自动识别不准确时，可以在这里校正。</p></div><button type="button" aria-label="关闭" onclick="document.getElementById(\'wordEditOverlay\').classList.remove(\'open\')">×</button></header><label>英文单词<input id="weWord"></label><label>中文释义<input id="weMeaning"></label><label>音标<input id="wePhonetic"></label><label>来源<input id="weSource"></label><label>音节拆分<input id="weSyllables" placeholder="用空格分隔，如 beau ti ful"></label><label>拼读提示<textarea id="weTip" rows="3"></textarea></label><label class="check-label"><input id="weIrregular" type="checkbox"> 标记为特殊拼写</label><button class="save" type="button" onclick="saveWordEdit()">保存修改</button></section>';
    overlay.addEventListener('click',event=>{if(event.target===overlay)overlay.classList.remove('open')});document.body.appendChild(overlay);
  }
  overlay.dataset.word=word;document.getElementById('weWord').value=item.word;document.getElementById('weMeaning').value=item.meaning||'';document.getElementById('wePhonetic').value=item.phonetic||'';document.getElementById('weSource').value=item.source||'';document.getElementById('weSyllables').value=(item.syllables||[]).join(' ');document.getElementById('weTip').value=item.phonicsTip||'';document.getElementById('weIrregular').checked=!!item.isIrregular;overlay.classList.add('open');setTimeout(()=>document.getElementById('weMeaning').focus(),50);
}
window.saveWordEdit=function(){
  const overlay=document.getElementById('wordEditOverlay'),oldWord=overlay?.dataset.word,list=safe(KEYS.words,[]),item=list.find(word=>word.word===oldWord);if(!item)return;
  const next=(document.getElementById('weWord').value||'').trim().toLowerCase();if(!/^[a-z][a-z'-]*$/.test(next)){notify('请输入有效英文单词');return}if(list.some(word=>word!==item&&word.word===next)){notify('这个单词已经存在');return}
  const syllables=document.getElementById('weSyllables').value.trim().split(/\s+/).filter(Boolean),analysis=typeof buildAnalysis==='function'?buildAnalysis(next):null;
  item.word=next;item.meaning=document.getElementById('weMeaning').value.trim();item.phonetic=document.getElementById('wePhonetic').value.trim();item.source=document.getElementById('weSource').value.trim()||'手动添加';item.syllables=syllables.length?syllables:(analysis?.syllables||[next]);item.chunks=analysis?.chunks||item.chunks;item.phonicsTip=document.getElementById('weTip').value.trim()||(analysis?.tip||'');item.isIrregular=document.getElementById('weIrregular').checked;
  if(!item.meaning){notify('请填写中文释义');return}write(KEYS.words,list);logActivity('english-edit',`编辑单词 ${next}`);location.reload();
};
function injectWordEdit(){
  document.querySelectorAll('.cards .card').forEach(card=>{const learn=card.querySelector('.actions .learn'),word=card.querySelector('.word')?.textContent?.trim();if(!learn||!word||card.querySelector('.edit-word'))return;const button=document.createElement('button');button.type='button';button.className='edit-word';button.textContent='编辑单词';button.onclick=()=>openWordEdit(word);learn.insertAdjacentElement('afterend',button)});
}
function patchEnglishIndicators(){
  if(!document.querySelector('.eng-shell'))return;
  const wordList=safe(KEYS.words,[]),history=safe(KEYS.history,[]),daily=safe(KEYS.daily,{}),settings={dailyLimit:8,...safe(KEYS.settings,{})},today=epochDay();
  const introduced=wordList.filter(word=>word.introducedDay===today).length,activities=Number(daily[String(today)]?.activities)||0,limit=Math.max(1,Number(settings.dailyLimit)||8),spells=history.filter(item=>item.type==='spell').slice(-20);
  const goal=document.getElementById('goalProgress'),bar=document.getElementById('todayBar'),progress=document.getElementById('todayProgress'),accuracy=document.getElementById('recentAccuracy');
  if(goal)goal.textContent=`${introduced} / ${limit} 词`;if(bar)bar.style.width=Math.min(100,introduced/limit*100)+'%';if(progress)progress.textContent=`今日练习 ${activities} 次`;if(accuracy)accuracy.textContent=spells.length?Math.round(spells.filter(item=>item.correct).length/spells.length*100)+'%':'—';
}
function patchHomeStats(){
  if(!document.querySelector('.home-shell'))return;
  const profile={mathWeeklyGoal:40,...safe(KEYS.profile,{})},settings={dailyLimit:8,...safe(KEYS.settings,{})},wordList=safe(KEYS.words,[]),daily=safe(KEYS.daily,{}),store=safe(KEYS.mathActivity,{entries:[]});
  const today=new Date(),dayIndex=(today.getDay()+6)%7,start=new Date(today);start.setHours(0,0,0,0);start.setDate(start.getDate()-dayIndex);
  const pad=n=>String(n).padStart(2,'0'),startKey=`${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}`,todayKey=`${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  const entries=Array.isArray(store.entries)?store.entries:[],mathWeek=entries.filter(item=>item.date>=startKey).reduce((sum,item)=>sum+(Number(item.count)||1),0),mathToday=entries.filter(item=>item.date===todayKey).reduce((sum,item)=>sum+(Number(item.count)||1),0);
  const startDay=epochDay(start.getTime()),todayDay=epochDay(),englishWeek=wordList.filter(word=>word.introducedDay!=null&&word.introducedDay>=startDay&&word.introducedDay<=todayDay).length,englishToday=wordList.filter(word=>word.introducedDay===todayDay).length,elapsed=todayDay-startDay+1,englishTarget=Math.max(1,(Number(settings.dailyLimit)||8)*elapsed);
  const mathGoal=Math.max(1,Number(profile.mathWeeklyGoal)||40),mathPercent=Math.min(100,Math.round(mathWeek/mathGoal*100)),englishPercent=Math.min(100,Math.round(englishWeek/englishTarget*100)),overall=Math.round((mathPercent+englishPercent)/2),activities=Number(daily[String(todayDay)]?.activities)||0;
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
  set('todayMath',mathToday);set('todayMathDone',`今日整理或复习 ${mathToday} 题`);set('todayEnglish',englishToday);set('todayEnglishDone',`今日练习 ${activities} 次`);set('mathProgress',mathPercent+'%');set('englishProgress',englishPercent+'%');set('overallProgress',overall+'%');set('mathTotal',`本周 ${mathWeek} / ${mathGoal} 题`);set('englishTotal',`本周 ${englishWeek} / ${englishTarget} 个新词`);
  const ring=document.getElementById('progressRing');if(ring){const total=mathPercent+englishPercent,purple=total?overall*(mathPercent/total):0;ring.style.background=`conic-gradient(var(--purple) 0 ${purple}%,#33b7a0 ${purple}% ${overall}%,#ececf5 ${overall}% 100%)`}
}
function rebuildRecent(){
  const box=document.getElementById('recentList');if(!box)return;
  let list=safe(KEYS.activity,[]).slice(-30);
  if(!list.length){const math=safe(KEYS.math,[]).map(q=>({type:'math-legacy',text:'整理数学错题',at:q.edited||q.at||0})),english=safe(KEYS.history,[]).map(item=>({type:'english-legacy',text:item.type==='spell'?'完成英语听写':'完成英语练习',at:item.at||0}));list=[...math,...english]}
  list=list.sort((a,b)=>b.at-a.at).slice(0,3);
  box.innerHTML=list.length?list.map(item=>{const english=String(item.type).includes('english')||item.type==='英语';return `<div class="recent-row"><span class="recent-icon ${english?'en':''}">${english?'abc':'×'}</span><b>${english?'英语':'数学'}</b><span>${escapeHtml(item.text)}</span><time>${new Date(item.at).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</time></div>`}).join(''):'<div class="recent-row">暂无学习记录</div>';
}
function patchRender(){
  const original=window.render;if(typeof original!=='function'||original.__reliable)return;
  const wrapped=function(...args){const result=original.apply(this,args);setTimeout(()=>{injectWordEdit();patchEnglishIndicators();patchHomeStats();rebuildRecent()},0);return result};wrapped.__reliable=true;window.render=wrapped;
}
function patchOpenProfile(){
  const original=window.openProfileSettings;if(typeof original!=='function'||original.__backup)return;
  const wrapped=function(...args){const result=original.apply(this,args);setTimeout(injectBackupManager,0);return result};wrapped.__backup=true;window.openProfileSettings=wrapped;
}
function keyboard(){
  document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;['profileOverlay','dataTransferOverlay','editOverlay','batchOverlay','paperBuilderOverlay','paperOverlay','lookupSheet','studyPage','wordEditOverlay'].forEach(id=>document.getElementById(id)?.classList.remove('open'));document.body.classList.remove('profile-modal-open','data-modal-open')});
}
function init(){
  migrateMath();repairEnglishDaily();patchEnglishNewWordFlow();patchRender();patchOpenProfile();keyboard();
  wrapDelete('removeQuestion',KEYS.math,'数学错题');wrapDelete('deleteSelected',KEYS.math,'所选数学错题');wrapDelete('removeWord',KEYS.words,'英语单词');
  wrapActivity('saveQuestion','math-edit','新增或编辑数学错题');wrapActivity('applyBatchStatus','math-review','批量更新数学掌握状态');wrapActivity('saveBatchEdit','math-edit','批量编辑数学错题');
  wrapWordAdd('savePending','新增');wrapWordAdd('runEnglishBatchImport','批量导入');
  if(typeof window.recordResult==='function'&&!window.recordResult.__activity){const original=window.recordResult;const wrapped=function(word,type,correct,score){const result=original.apply(this,arguments);if(score&&type==='spell')logActivity('english-spell',`${correct?'听写正确':'听写错误'}：${word?.word||''}`);return result};wrapped.__activity=true;window.recordResult=wrapped}
  setTimeout(()=>{injectWordEdit();patchEnglishIndicators();patchHomeStats();rebuildRecent()},80);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();