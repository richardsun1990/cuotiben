(function(){
  'use strict';
  const MATH_KEY='cuoti_v3';
  const WORD_KEY='dudu_vocab_v2';
  const DAILY_KEY='dudu_vocab_daily_v1';
  const safe=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};

  function syncEnglishDailyMemory(){
    const wordList=safe(WORD_KEY,[]),stored=safe(DAILY_KEY,{});
    if(!Array.isArray(wordList)||!stored||typeof stored!=='object')return;
    const counts={};
    wordList.forEach(word=>{if(word.introducedDay!=null)counts[String(word.introducedDay)]=(counts[String(word.introducedDay)]||0)+1});
    Object.keys(stored).forEach(key=>{stored[key]={activities:0,correct:0,sessions:0,...(stored[key]||{}),newWords:counts[key]||0}});
    Object.entries(counts).forEach(([key,count])=>{if(!stored[key])stored[key]={activities:0,correct:0,sessions:0,newWords:count};else stored[key].newWords=count});
    localStorage.setItem(DAILY_KEY,JSON.stringify(stored));
    try{
      if(typeof daily!=='undefined'&&daily&&typeof daily==='object'){
        Object.keys(daily).forEach(key=>delete daily[key]);
        Object.assign(daily,stored);
      }
      if(typeof persist==='function')persist();
    }catch(error){console.error(error)}
  }

  function stripLegacyDrawings(){
    const list=safe(MATH_KEY,[]);if(!Array.isArray(list))return false;
    let changed=false;
    list.forEach(item=>{if(item&&Object.prototype.hasOwnProperty.call(item,'ansImg')){delete item.ansImg;changed=true}});
    if(changed)localStorage.setItem(MATH_KEY,JSON.stringify(list));
    try{
      if(typeof qs!=='undefined'&&Array.isArray(qs)){
        qs.forEach(item=>{if(item&&Object.prototype.hasOwnProperty.call(item,'ansImg'))delete item.ansImg});
        if(typeof save==='function')save();
        if(typeof render==='function')render();
      }
    }catch(error){console.error(error)}
    return changed;
  }

  function patchMathImport(){
    const open=window.openMathImport;
    if(typeof open==='function'&&!open.__noDrawing){
      const wrapped=function(...args){
        const result=open.apply(this,args);
        setTimeout(()=>{
          const note=document.querySelector('#dataTransferBody .data-note');
          if(note)note.innerHTML='<b>导入内容：</b>题目、答案、知识点、出错原因和掌握状态都会保留。旧备份中的手写图片不会导入。';
        },0);
        return result;
      };
      wrapped.__noDrawing=true;window.openMathImport=wrapped;
    }
    const run=window.runMathImport;
    if(typeof run==='function'&&!run.__noDrawing){
      const wrapped=async function(...args){
        const result=await run.apply(this,args);
        stripLegacyDrawings();
        window.logDuduActivity?.('math-import','导入数学错题备份');
        return result;
      };
      wrapped.__noDrawing=true;window.runMathImport=wrapped;
    }
  }

  function patchStorageWarning(){
    try{
      const used=Object.keys(localStorage).reduce((sum,key)=>sum+(localStorage.getItem(key)||'').length*2,0);
      if(used>4*1024*1024&&!sessionStorage.getItem('dudu_storage_warning')){
        sessionStorage.setItem('dudu_storage_warning','1');
        setTimeout(()=>{if(typeof window.toast==='function')window.toast('本地数据较多，建议立即导出完整备份');},600);
      }
    }catch(error){console.error(error)}
  }

  function init(){syncEnglishDailyMemory();stripLegacyDrawings();patchMathImport();patchStorageWarning()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();