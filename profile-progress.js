(function(){
  'use strict';

  const PROFILE_KEY='dudu_user_profile_v1';
  const MATH_ACTIVITY_KEY='dudu_math_activity_v1';
  const MATH_KEY='cuoti_v3';
  const ENGLISH_DAILY_KEY='dudu_vocab_daily_v1';
  const ENGLISH_SETTINGS_KEY='dudu_vocab_settings_v1';
  const DAY=86400000;
  const DEFAULT_PROFILE={name:'嘟嘟同学',grade:'三年级',mathWeeklyGoal:40};

  function safe(key,fallback){try{const value=JSON.parse(localStorage.getItem(key)||'null');return value??fallback}catch{return fallback}}
  function saveJson(key,value){localStorage.setItem(key,JSON.stringify(value))}
  function clamp(value,min,max){return Math.min(max,Math.max(min,value))}
  function localDateKey(time=Date.now()){
    const d=new Date(time),pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function weekStartDate(){const d=new Date();d.setHours(0,0,0,0);const offset=(d.getDay()+6)%7;d.setDate(d.getDate()-offset);return d}
  function currentEpochDay(){return Math.floor(Date.now()/DAY)}
  function currentWeekStartEpochDay(){const d=new Date(),offset=(d.getDay()+6)%7;return currentEpochDay()-offset}
  function getProfile(){return {...DEFAULT_PROFILE,...safe(PROFILE_KEY,{})}}
  function getEnglishSettings(){return {dailyLimit:8,...safe(ENGLISH_SETTINGS_KEY,{})}}
  function notify(message){if(typeof window.toast==='function')window.toast(message);else alert(message)}

  function ensureProfileModal(){
    if(document.getElementById('profileOverlay'))return;
    const overlay=document.createElement('div');overlay.id='profileOverlay';overlay.className='profile-overlay';
    overlay.innerHTML=`<section class="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profileTitle">
      <header><div><h2 id="profileTitle">学习资料与目标</h2><p>资料和目标只保存在当前浏览器中。</p></div><button type="button" class="profile-close" aria-label="关闭">×</button></header>
      <div class="profile-body">
        <label>学习昵称<input id="profileName" maxlength="12" placeholder="如：嘟嘟同学"></label>
        <label>所在年级<select id="profileGrade"><option value="未设置">未设置</option><option>一年级</option><option>二年级</option><option>三年级</option><option>四年级</option><option>五年级</option><option>六年级</option><option>初一</option><option>初二</option><option>初三</option></select></label>
        <div class="profile-goal-grid">
          <label>数学每周目标<div class="profile-number"><input id="profileMathGoal" type="number" min="1" max="200" step="1" inputmode="numeric"><span>题 / 周</span></div></label>
          <label>英语每日新词<div class="profile-number"><input id="profileEnglishGoal" type="number" min="1" max="50" step="1" inputmode="numeric"><span>词 / 天</span></div></label>
        </div>
        <div class="profile-note">目标会同步用于首页本周进度、数学周计划和英语“今日新词”安排。</div>
        <button type="button" class="profile-save">保存设置</button>
      </div>
    </section>`;
    overlay.addEventListener('click',e=>{if(e.target===overlay)window.closeProfileSettings()});
    overlay.querySelector('.profile-close').addEventListener('click',window.closeProfileSettings);
    overlay.querySelector('.profile-save').addEventListener('click',window.saveProfileSettings);
    document.body.appendChild(overlay);
  }

  window.openProfileSettings=function(){
    ensureProfileModal();const profile=getProfile(),english=getEnglishSettings();
    document.getElementById('profileName').value=profile.name;
    document.getElementById('profileGrade').value=profile.grade||'未设置';
    document.getElementById('profileMathGoal').value=profile.mathWeeklyGoal||40;
    document.getElementById('profileEnglishGoal').value=english.dailyLimit||8;
    document.getElementById('profileOverlay').classList.add('open');document.body.classList.add('profile-modal-open');
    setTimeout(()=>document.getElementById('profileName').focus(),60);
  };
  window.closeProfileSettings=function(){document.getElementById('profileOverlay')?.classList.remove('open');document.body.classList.remove('profile-modal-open')};
  window.saveProfileSettings=function(){
    const name=(document.getElementById('profileName').value||'').trim().slice(0,12);
    if(!name){notify('请填写学习昵称');return}
    const grade=document.getElementById('profileGrade').value||'未设置';
    const mathWeeklyGoal=clamp(Math.round(Number(document.getElementById('profileMathGoal').value)||40),1,200);
    const englishDailyGoal=clamp(Math.round(Number(document.getElementById('profileEnglishGoal').value)||8),1,50);
    saveJson(PROFILE_KEY,{name,grade,mathWeeklyGoal});
    saveJson(ENGLISH_SETTINGS_KEY,{...getEnglishSettings(),dailyLimit:englishDailyGoal});
    const dailyInput=document.getElementById('dailyLimit');
    if(dailyInput){dailyInput.value=String(englishDailyGoal);if(typeof window.saveSettings==='function')window.saveSettings()}
    window.closeProfileSettings();applyProfile();updatePageStats();notify('学习资料和目标已保存');
  };

  function applyProfile(){
    const profile=getProfile(),english=getEnglishSettings();
    document.querySelectorAll('[data-user-name]').forEach(el=>el.textContent=profile.name);
    document.querySelectorAll('[data-user-grade]').forEach(el=>el.textContent=profile.grade==='未设置'?'':profile.grade);
    document.querySelectorAll('[data-english-daily-goal]').forEach(el=>el.textContent=`${english.dailyLimit}词/天`);
    document.querySelectorAll('[data-profile-trigger]').forEach(el=>{
      el.setAttribute('title','修改学习资料与目标');el.setAttribute('aria-label',`修改${profile.name}的学习资料与目标`);
    });
  }

  function readMathQuestions(){const data=safe(MATH_KEY,[]);return Array.isArray(data)?data.filter(q=>!q.subject||q.subject==='数学'):[]}
  function seedMathActivity(){
    let store=safe(MATH_ACTIVITY_KEY,null);
    if(store&&Array.isArray(store.entries))return store;
    const entries=readMathQuestions().map(q=>({date:localDateKey(q.edited||q.at||Date.now()),type:'legacy',count:1,at:q.edited||q.at||Date.now()}));
    store={version:1,entries:entries.slice(-1500)};saveJson(MATH_ACTIVITY_KEY,store);return store;
  }
  function mathActivityStore(){return seedMathActivity()}
  function addMathActivity(type,count){
    count=Math.max(1,Number(count)||1);const store=mathActivityStore();
    store.entries.push({date:localDateKey(),type,count,at:Date.now()});store.entries=store.entries.slice(-2000);saveJson(MATH_ACTIVITY_KEY,store);
  }
  function mathActivitySummary(){
    const entries=mathActivityStore().entries||[],start=weekStartDate(),startKey=localDateKey(start),todayKey=localDateKey();
    const week=entries.filter(e=>e.date>=startKey).reduce((sum,e)=>sum+(Number(e.count)||1),0);
    const today=entries.filter(e=>e.date===todayKey).reduce((sum,e)=>sum+(Number(e.count)||1),0);
    const active=new Set(entries.map(e=>e.date));let streak=0,d=new Date();d.setHours(0,0,0,0);
    if(!active.has(localDateKey(d))){d.setDate(d.getDate()-1)}
    while(active.has(localDateKey(d))){streak++;d.setDate(d.getDate()-1)}
    return {week,today,streak};
  }
  function countChangedMath(before,after){
    const beforeMap=new Map(before.map(q=>[String(q.id),JSON.stringify(q)]));let changed=0;
    after.forEach(q=>{if(beforeMap.get(String(q.id))!==JSON.stringify(q))changed++});return changed;
  }
  function wrapMathMutation(name){
    const original=window[name];if(typeof original!=='function'||original.__profileWrapped)return;
    const wrapped=function(...args){const before=readMathQuestions(),result=original.apply(this,args);setTimeout(()=>{const after=readMathQuestions(),changed=countChangedMath(before,after);if(changed){addMathActivity(name,changed);updateMathStats();updateHomeStats()}},0);return result};
    wrapped.__profileWrapped=true;window[name]=wrapped;
  }

  function updateMathStats(){
    if(!document.querySelector('.app-shell'))return;
    const profile=getProfile(),summary=mathActivitySummary(),goal=profile.mathWeeklyGoal||40;
    const goalText=document.getElementById('weekGoalText'),goalBar=document.getElementById('weekGoalBar'),streak=document.getElementById('mathStreak'),today=document.getElementById('todayChallenges');
    if(goalText)goalText.textContent=`${summary.week} / ${goal} 题`;
    if(goalBar)goalBar.style.width=clamp(summary.week/goal*100,0,100)+'%';
    if(streak)streak.textContent=`${summary.streak} 天`;
    if(today)today.textContent=`${summary.today} 题`;
  }

  function englishWeekSummary(){
    const daily=safe(ENGLISH_DAILY_KEY,{}),settings=getEnglishSettings();
    const start=currentWeekStartEpochDay(),today=currentEpochDay();let newWords=0,activities=0;
    for(let d=start;d<=today;d++){const item=daily[String(d)]||{};newWords+=Number(item.newWords)||0;activities+=Number(item.activities)||0}
    const elapsed=today-start+1,target=Math.max(1,(Number(settings.dailyLimit)||8)*elapsed);
    const todayRecord=daily[String(today)]||{};
    return {newWords,activities,target,todayNewWords:Number(todayRecord.newWords)||0,todayActivities:Number(todayRecord.activities)||0,dailyLimit:Number(settings.dailyLimit)||8};
  }
  function updateEnglishStats(){
    if(!document.querySelector('.eng-shell'))return;
    const summary=englishWeekSummary(),goal=document.getElementById('goalProgress'),bar=document.getElementById('todayBar'),text=document.getElementById('todayProgress'),input=document.getElementById('dailyLimit');
    if(input)input.value=String(summary.dailyLimit);
    if(goal)goal.textContent=`${summary.todayNewWords} / ${summary.dailyLimit} 词`;
    if(bar)bar.style.width=clamp(summary.todayNewWords/summary.dailyLimit*100,0,100)+'%';
    if(text)text.textContent=`今日练习 ${summary.todayActivities} 次`;
  }

  function updateHomeStats(){
    if(!document.querySelector('.home-shell'))return;
    const profile=getProfile(),math=mathActivitySummary(),english=englishWeekSummary();
    const mathGoal=profile.mathWeeklyGoal||40,mp=clamp(Math.round(math.week/mathGoal*100),0,100),ep=clamp(Math.round(english.newWords/english.target*100),0,100),overall=Math.round((mp+ep)/2);
    const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
    set('todayMath',math.today);set('todayMathDone',`今日整理或复习 ${math.today} 题`);set('todayEnglish',english.todayNewWords);set('todayEnglishDone',`今日练习 ${english.todayActivities} 次`);
    set('mathProgress',mp+'%');set('englishProgress',ep+'%');set('overallProgress',overall+'%');set('mathTotal',`本周 ${math.week} / ${mathGoal} 题`);set('englishTotal',`本周 ${english.newWords} / ${english.target} 个新词`);
    const ring=document.getElementById('progressRing');if(ring){const total=mp+ep,purple=total?overall*(mp/total):0;ring.style.background=`conic-gradient(var(--purple) 0 ${purple}%,#33b7a0 ${purple}% ${overall}%,#ececf5 ${overall}% 100%)`}
  }

  function updatePrintedName(){const first=document.querySelector('.paper-title>div span:first-child');if(first)first.textContent=`姓名：${getProfile().name}`}
  function wrapRender(){
    if(typeof window.render==='function'&&!window.render.__profileWrapped){const original=window.render;const wrapped=function(...args){const result=original.apply(this,args);updateMathStats();updateEnglishStats();applyProfile();return result};wrapped.__profileWrapped=true;window.render=wrapped}
    if(typeof window.renderPaper==='function'&&!window.renderPaper.__profileWrapped){const original=window.renderPaper;const wrapped=function(...args){const result=original.apply(this,args);updatePrintedName();return result};wrapped.__profileWrapped=true;window.renderPaper=wrapped}
  }
  function updatePageStats(){updateHomeStats();updateMathStats();updateEnglishStats();updatePrintedName()}

  function init(){
    applyProfile();wrapRender();['saveQuestion','applyBatchStatus','saveBatchEdit','saveDrawing'].forEach(wrapMathMutation);updatePageStats();
    window.addEventListener('storage',e=>{if([PROFILE_KEY,MATH_ACTIVITY_KEY,ENGLISH_DAILY_KEY,ENGLISH_SETTINGS_KEY,MATH_KEY].includes(e.key)){applyProfile();updatePageStats()}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();