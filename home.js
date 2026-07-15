(function(){
'use strict';
const safe=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const esc=value=>String(value||'').replace(/[&<>]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[char]));
window.scrollToStats=function(){document.getElementById('statsSection')?.scrollIntoView({behavior:'smooth'})};
function init(){
  const questions=safe('cuoti_v3',[]).filter(item=>!item.subject||item.subject==='数学');
  const words=safe('dudu_vocab_v2',[]);
  const mathPreview=[...questions].sort((a,b)=>(b.edited||b.at||0)-(a.edited||a.at||0)).slice(0,3);
  const mathBox=document.getElementById('homeMathPreview');
  if(mathBox)mathBox.innerHTML=mathPreview.length?mathPreview.map(item=>`<div class="mini-row"><span></span><b>${esc((item.tag||item.q).slice(0,10))}</b><em>${item.status==='done'?'已掌握':item.status==='review'?'复习中':'未掌握'}</em></div>`).join(''):'<div class="mini-row">还没有错题，点击进入添加</div>';
  const currentDay=Math.floor(Date.now()/86400000),word=words.find(item=>item.weak)||words.find(item=>(item.due||0)<=currentDay)||words[0],wordBox=document.getElementById('homeWordPreview');
  if(wordBox)wordBox.innerHTML=word?`<div class="word-preview-card"><h4>${esc(word.word)}　<span>🔊</span></h4><div class="phon">${esc(word.phonetic||'')}</div><div class="split">${(word.syllables||[word.word]).map(esc).join(' · ')}</div><div>${esc(word.meaning)}</div><small>已学单词 ${words.filter(item=>item.seen>0).length} / ${words.length}</small><div class="bar"><i style="width:${words.length?words.filter(item=>item.seen>0).length/words.length*100:0}%"></i></div></div>`:'<div class="word-preview-card">还没有单词，点击进入英语学习</div>';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();