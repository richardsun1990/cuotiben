const KEY='cuoti_v3';
const MATH_ACTIVITY_KEY='dudu_math_activity_v1';
const $=id=>document.getElementById(id);
const esc=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const statusLabel={wrong:'未掌握',review:'复习中',done:'已掌握'};
let qs=[];
try{qs=JSON.parse(localStorage.getItem(KEY)||'[]')}catch{qs=[]}
if(!Array.isArray(qs))qs=[];
qs=qs.map(q=>{const copy={...q,subject:q.subject||'数学'};delete copy.ansImg;return copy});
let status='all',editId=null,selected=new Set(),selectionMode=false,lastFiltered=[],paperQuestions=[];

function save(){
  try{localStorage.setItem(KEY,JSON.stringify(qs));return true}
  catch(error){toast('保存失败，请先导出完整备份并清理浏览器空间');console.error(error);return false}
}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function toast(text){const e=$('toast');if(!e){alert(text);return}e.textContent=text;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),2200)}
function mathQuestions(){return qs.filter(q=>q.subject==='数学')}
function getQuestion(id){return qs.find(q=>q.id===id&&q.subject==='数学')}
function setStatus(value,el){status=value;document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b===el));render()}
function setNodeNumber(id,value){const el=$(id);if(el)el.firstChild.nodeValue=String(value)}
function reviewTime(q){return Number(q.lastReviewedAt)||0}
function recordMathActivityLocal(type,count){try{const store=JSON.parse(localStorage.getItem(MATH_ACTIVITY_KEY)||'null')||{version:1,entries:[]};const d=new Date(),pad=n=>String(n).padStart(2,'0');store.entries=Array.isArray(store.entries)?store.entries:[];store.entries.push({date:`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,type,count:Math.max(1,Number(count)||1),at:Date.now()});store.entries=store.entries.slice(-2000);localStorage.setItem(MATH_ACTIVITY_KEY,JSON.stringify(store))}catch(error){console.error(error)}}

function filteredQuestions(){
  const all=mathQuestions();
  const term=($('searchInput')?.value||'').trim().toLowerCase();
  const chapter=$('chapterFilter')?.value||'all';
  const type=$('typeFilter')?.value||'all';
  const sort=$('sortFilter')?.value||'created-desc';
  const list=all.filter(x=>(status==='all'||x.status===status)&&(!term||[x.q,x.tag,x.reason,x.a].some(v=>String(v||'').toLowerCase().includes(term)))&&(chapter==='all'||x.tag===chapter)&&(type==='all'||(type==='有答案'&&x.a)||(type==='无答案'&&!x.a)));
  return list.sort((a,b)=>{
    if(sort==='review-desc')return reviewTime(b)-reviewTime(a)||(b.edited||b.at||0)-(a.edited||a.at||0);
    if(sort==='created-asc')return (a.at||0)-(b.at||0);
    return (b.at||0)-(a.at||0);
  });
}

function render(){
  const all=mathQuestions();
  selected=new Set([...selected].filter(id=>all.some(q=>q.id===id)));
  const wrong=all.filter(q=>q.status==='wrong').length,review=all.filter(q=>q.status==='review').length,done=all.filter(q=>q.status==='done').length;
  setNodeNumber('totalCount',all.length);setNodeNumber('wrongCount',wrong);setNodeNumber('reviewCount',review);setNodeNumber('doneCount',done);
  $('mathAccuracy').textContent=all.length?Math.round(done/all.length*100)+'%':'0%';
  $('tabAll').textContent=`(${all.length})`;$('tabWrong').textContent=`(${wrong})`;$('tabReview').textContent=`(${review})`;$('tabDone').textContent=`(${done})`;
  $('sideTotal').textContent=`${all.length} 题`;$('sideWeak').textContent=`${wrong+review} 题`;
  const keepChapter=$('chapterFilter').value;
  const tags=[...new Set(all.map(q=>q.tag).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
  $('chapterFilter').innerHTML='<option value="all">全部章节</option>'+tags.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  if(tags.includes(keepChapter))$('chapterFilter').value=keepChapter;
  lastFiltered=filteredQuestions();
  $('questionGrid').innerHTML=lastFiltered.length?lastFiltered.map(cardHtml).join(''):'<div class="empty empty-card"><img class="q-empty-art" src="assets/empty-box.svg" alt="暂无数据"><b>暂无符合条件的数学错题</b><span>调整筛选条件，或点击“手动录入”添加第一道题。</span><button onclick="openAdd()">去添加</button></div>';
  updateBatchBar();
  window.refreshLearningStats?.();
}

function cardHtml(x){
  const checked=selected.has(x.id);
  const created=new Date(x.at||Date.now()).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'});
  const reviewed=x.lastReviewedAt?new Date(x.lastReviewedAt).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'}):'—';
  return `<article class="q-card ${checked?'selected':''}" data-id="${x.id}"><div class="q-head"><label class="q-check-wrap" title="选择这道题"><input type="checkbox" ${checked?'checked':''} onchange="toggleSelection('${x.id}',this.checked)"><span></span></label>${x.tag?`<span class="q-sub">${esc(x.tag)}</span>`:'<span class="q-sub muted-pill">未分类</span>'}<span class="q-status ${x.status||'wrong'}">${statusLabel[x.status]||'未掌握'}</span></div><div class="q-text">${esc(x.q)}</div>${x.a?`<div class="q-answer-preview"><b>答案：</b>${esc(x.a).slice(0,80)}${x.a.length>80?'…':''}</div>`:''}<div class="q-meta"><span>${x.reason?`出错原因：${esc(x.reason)}`:'手动录入'}</span><span>录入 ${created} · 最近复习 ${reviewed}</span></div><div class="q-actions"><button onclick="openEdit('${x.id}')">编辑</button><button onclick="removeQuestion('${x.id}')">删除</button></div></article>`;
}

function enableSelection(){selectionMode=true;$('batchBar').classList.add('show');toast('请勾选需要统一管理的错题')}
function toggleSelection(id,checked){checked?selected.add(id):selected.delete(id);selectionMode=selected.size>0;render()}
function selectAllFiltered(){lastFiltered.forEach(q=>selected.add(q.id));selectionMode=selected.size>0;render();toast(`已选择当前 ${lastFiltered.length} 题`)}
function clearSelection(){selected.clear();selectionMode=false;render()}
function updateBatchBar(){const bar=$('batchBar');bar.classList.toggle('show',selectionMode||selected.size>0);$('selectedCount').textContent=`已选择 ${selected.size} 题`;$('batchStatus').value=''}
function applyBatchStatus(value){if(!value)return;if(!selected.size){toast('请先选择错题');return}const now=Date.now();qs.forEach(q=>{if(selected.has(q.id)){q.status=value;q.edited=now;q.lastReviewedAt=now}});if(save()){render();toast(`已将 ${selected.size} 题设为${statusLabel[value]}`)}}
function openBatchEdit(){if(!selected.size){toast('请先选择错题');return}$('batchTag').value='';$('batchReason').value='';$('batchEditStatus').value='';$('batchOverlay').classList.add('open')}
function closeBatchEdit(){$('batchOverlay').classList.remove('open')}
function saveBatchEdit(){if(!selected.size){closeBatchEdit();return}const tag=$('batchTag').value.trim(),reason=$('batchReason').value.trim(),st=$('batchEditStatus').value;if(!tag&&!reason&&!st){toast('至少填写一项修改内容');return}let count=0;const now=Date.now();qs.forEach(q=>{if(selected.has(q.id)){if(tag)q.tag=tag;if(reason)q.reason=reason;if(st){q.status=st;q.lastReviewedAt=now}q.edited=now;count++}});if(save()){closeBatchEdit();render();toast(`已批量更新 ${count} 道错题`)}}
function deleteSelected(){if(!selected.size){toast('请先选择错题');return}if(!confirm(`确定删除已选择的 ${selected.size} 道错题吗？删除后可在 10 秒内撤销。`))return;qs=qs.filter(q=>!selected.has(q.id));const count=selected.size;selected.clear();selectionMode=false;if(save()){render();toast(`已删除 ${count} 道错题`)}}

function openAdd(){editId=null;$('modalTitle').textContent='新增数学错题';['fQ','fA','fTag','fReason'].forEach(id=>$(id).value='');$('fStatus').value='wrong';$('editOverlay').classList.add('open');setTimeout(()=>$('fQ').focus(),100)}
function openEdit(id){const x=getQuestion(id);if(!x)return;editId=id;$('modalTitle').textContent='编辑数学错题';$('fQ').value=x.q||'';$('fA').value=x.a||'';$('fTag').value=x.tag||'';$('fReason').value=x.reason||'';$('fStatus').value=x.status||'wrong';$('editOverlay').classList.add('open')}
function closeEdit(){$('editOverlay').classList.remove('open')}
function saveQuestion(){const text=$('fQ').value.trim();if(!text){toast('请填写题目内容');$('fQ').focus();return}const data={q:text,a:$('fA').value.trim(),subject:'数学',tag:$('fTag').value.trim(),reason:$('fReason').value.trim(),status:$('fStatus').value};if(editId){const x=getQuestion(editId);if(!x)return;Object.assign(x,data,{edited:Date.now()})}else qs.unshift({...data,id:uid(),at:Date.now(),lastReviewedAt:null,correctStreak:0});if(save()){closeEdit();render();toast(editId?'错题已更新':'数学错题已添加')}}
function removeQuestion(id){if(!confirm('确定删除这道数学错题吗？删除后可在 10 秒内撤销。'))return;qs=qs.filter(q=>q.id!==id);selected.delete(id);if(save()){render();toast('错题已删除')}}

function sourceQuestions(source){if(source==='selected')return mathQuestions().filter(q=>selected.has(q.id));if(source==='filtered')return [...lastFiltered];if(source==='wrong')return mathQuestions().filter(q=>q.status==='wrong');return mathQuestions()}
function openPaperBuilder(preferred){const source=preferred==='selected'||selected.size?'selected':lastFiltered.length?'filtered':'wrong';$('paperSource').value=source;$('paperTitle').value='数学错题专项练习';$('paperIncludeAnswer').checked=false;updatePaperAvailability();$('paperBuilderOverlay').classList.add('open')}
function closePaperBuilder(){$('paperBuilderOverlay').classList.remove('open')}
function updatePaperAvailability(){const list=sourceQuestions($('paperSource').value),max=Math.max(1,list.length),count=$('paperCount');count.max=max;count.value=Math.min(Number(count.value)||10,max);$('paperSourceNote').textContent=list.length?`该范围共有 ${list.length} 道题，可自由设置题量。`:'该范围暂时没有题目，请更换题目来源。'}
function generatePaper(){const list=sourceQuestions($('paperSource').value);if(!list.length){toast('当前范围没有可组卷的题目');return}const count=Math.min(Math.max(1,Number($('paperCount').value)||list.length),list.length);paperQuestions=shuffle([...list]).slice(0,count);renderPaper($('paperTitle').value.trim()||'数学错题专项练习',$('paperIncludeAnswer').checked);closePaperBuilder();$('paperOverlay').classList.add('open')}
function openPrintPreview(){const list=selected.size?sourceQuestions('selected'):lastFiltered;if(!list.length){toast('当前没有可以打印的错题');return}paperQuestions=[...list];renderPaper('数学错题复习清单',true);$('paperOverlay').classList.add('open')}
function renderPaper(title,includeAnswers){const date=new Date().toLocaleDateString('zh-CN');$('paperContent').innerHTML=`<header class="paper-title"><h1>${esc(title)}</h1><div><span>姓名：____________</span><span>日期：${date}</span><span>得分：________</span></div></header><section class="paper-question-list">${paperQuestions.map((q,i)=>`<article data-id="${esc(q.id)}"><h3>${i+1}. ${esc(q.q)}</h3>${q.tag?`<small>知识点：${esc(q.tag)}</small>`:''}<div class="answer-space"></div><div class="paper-grade"><span>本题结果</span><label><input type="radio" name="grade-${i}" value="correct">做对</label><label><input type="radio" name="grade-${i}" value="wrong">做错</label><label><input type="radio" name="grade-${i}" value="skip" checked>暂不记录</label></div></article>`).join('')}</section>${includeAnswers?`<section class="paper-answers"><h2>答案与解析</h2>${paperQuestions.map((q,i)=>`<article><b>${i+1}.</b> ${q.a?esc(q.a):'暂未填写答案'}${q.reason?`<small>出错原因：${esc(q.reason)}</small>`:''}</article>`).join('')}</section>`:''}`;window.updatePrintedName?.()}
function finishPaperReview(){let correct=0,wrong=0;const now=Date.now();document.querySelectorAll('#paperContent .paper-question-list article').forEach((article,i)=>{const result=document.querySelector(`input[name="grade-${i}"]:checked`)?.value;if(!result||result==='skip')return;const q=getQuestion(article.dataset.id);if(!q)return;q.lastReviewedAt=now;q.edited=now;if(result==='correct'){q.correctStreak=(q.correctStreak||0)+1;q.status=q.correctStreak>=2?'done':'review';correct++}else{q.correctStreak=0;q.status='wrong';wrong++}});const count=correct+wrong;if(!count){toast('请至少标记一道题的练习结果');return}if(!save())return;recordMathActivityLocal('paper-review',count);window.logDuduActivity?.('math-paper',`完成练习卷：做对 ${correct} 题，做错 ${wrong} 题`,count);toast(`练习结果已保存：做对 ${correct} 题，做错 ${wrong} 题`);closePaperPreview();render()}
function closePaperPreview(){$('paperOverlay').classList.remove('open')}
function printGeneratedPaper(){document.body.classList.add('printing-paper');window.print();setTimeout(()=>document.body.classList.remove('printing-paper'),500)}
function shuffle(arr){for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}

function insertFormula(symbol){const q=$('fQ'),start=q.selectionStart,end=q.selectionEnd;q.setRangeText(symbol,start,end,'end');q.focus()}
function refreshTagSuggestions(){const dl=$('mathTags');if(!dl)return;const tags=[...new Set(mathQuestions().map(q=>q.tag).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN'));dl.innerHTML=tags.map(t=>`<option value="${esc(t)}"></option>`).join('')}
window.addEventListener('afterprint',()=>document.body.classList.remove('printing-paper'));
save();refreshTagSuggestions();render();