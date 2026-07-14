const KEY='cuoti_v3';
const $=id=>document.getElementById(id);
const esc=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const statusLabel={wrong:'未掌握',review:'复习中',done:'已掌握'};
let qs=[];
try{qs=JSON.parse(localStorage.getItem(KEY)||'[]')}catch{qs=[]}
if(!Array.isArray(qs))qs=[];
qs=qs.map(q=>({...q,subject:q.subject||'数学'}));
let status='all',editId=null,selected=new Set(),selectionMode=false,lastFiltered=[],paperQuestions=[];
let drawId=null,drawMode='pen',strokes=[],currentStroke=null;

function save(){localStorage.setItem(KEY,JSON.stringify(qs))}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function toast(text){const e=$('toast');e.textContent=text;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),2200)}
function mathQuestions(){return qs.filter(q=>q.subject==='数学')}
function getQuestion(id){return qs.find(q=>q.id===id&&q.subject==='数学')}
function setStatus(value,el){status=value;document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b===el));render()}
function setNodeNumber(id,value){const el=$(id);if(el)el.firstChild.nodeValue=String(value)}

function filteredQuestions(){
  const all=mathQuestions();
  const term=($('searchInput')?.value||'').trim().toLowerCase();
  const chapter=$('chapterFilter')?.value||'all';
  const type=$('typeFilter')?.value||'all';
  const desc=($('sortFilter')?.value||'desc')==='desc';
  return all.filter(x=>
    (status==='all'||x.status===status)&&
    (!term||[x.q,x.tag,x.reason,x.a].some(v=>String(v||'').toLowerCase().includes(term)))&&
    (chapter==='all'||x.tag===chapter)&&
    (type==='all'||(type==='有答案'&&x.a)||(type==='无答案'&&!x.a)||(type==='已作答'&&x.ansImg))
  ).sort((a,b)=>desc?(b.at||0)-(a.at||0):(a.at||0)-(b.at||0));
}

function render(){
  const all=mathQuestions();
  selected=new Set([...selected].filter(id=>all.some(q=>q.id===id)));
  const wrong=all.filter(q=>q.status==='wrong').length;
  const review=all.filter(q=>q.status==='review').length;
  const done=all.filter(q=>q.status==='done').length;
  setNodeNumber('totalCount',all.length);setNodeNumber('wrongCount',wrong);setNodeNumber('reviewCount',review);setNodeNumber('doneCount',done);
  $('mathAccuracy').textContent=all.length?Math.round(done/all.length*100)+'%':'0%';
  $('tabAll').textContent=`(${all.length})`;$('tabWrong').textContent=`(${wrong})`;$('tabReview').textContent=`(${review})`;$('tabDone').textContent=`(${done})`;
  $('sideTotal').textContent=`${all.length} 题`;$('sideWeak').textContent=`${wrong+review} 题`;
  $('weekGoalText').textContent=`${Math.min(all.length,40)} / 40 题`;$('weekGoalBar').style.width=Math.min(100,all.length/40*100)+'%';
  const activeDays=new Set(all.map(q=>new Date(q.edited||q.at||0).toDateString()));$('mathStreak').textContent=`${all.length?Math.min(7,Math.max(1,activeDays.size)):0} 天`;
  $('todayChallenges').textContent=`${all.filter(q=>Date.now()-(q.edited||q.at||0)<86400000).length} 题`;

  const keepChapter=$('chapterFilter').value;
  const tags=[...new Set(all.map(q=>q.tag).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
  $('chapterFilter').innerHTML='<option value="all">全部章节</option>'+tags.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  if(tags.includes(keepChapter))$('chapterFilter').value=keepChapter;

  lastFiltered=filteredQuestions();
  $('questionGrid').innerHTML=lastFiltered.length?lastFiltered.map(cardHtml).join(''):'<div class="empty empty-card"><img class="q-empty-art" src="assets/empty-box.svg" alt="暂无数据"><b>暂无符合条件的数学错题</b><span>调整筛选条件，或点击“手动录入”添加第一道题。</span><button onclick="openAdd()">去添加</button></div>';
  updateBatchBar();
}

function cardHtml(x){
  const checked=selected.has(x.id);
  const date=new Date(x.at||Date.now()).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'});
  return `<article class="q-card ${checked?'selected':''}" data-id="${x.id}">
    <div class="q-head">
      <label class="q-check-wrap" title="选择这道题"><input type="checkbox" ${checked?'checked':''} onchange="toggleSelection('${x.id}',this.checked)"><span></span></label>
      ${x.tag?`<span class="q-sub">${esc(x.tag)}</span>`:'<span class="q-sub muted-pill">未分类</span>'}
      <span class="q-status ${x.status||'wrong'}">${statusLabel[x.status]||'未掌握'}</span>
    </div>
    <div class="q-text">${esc(x.q)}</div>
    ${x.a?`<div class="q-answer-preview"><b>答案：</b>${esc(x.a).slice(0,80)}${x.a.length>80?'…':''}</div>`:''}
    <div class="q-meta"><span>${x.reason?`出错原因：${esc(x.reason)}`:'手动录入'}</span><span>${date}${x.ansImg?' · 已作答':''}</span></div>
    <div class="q-actions"><button onclick="openDraw('${x.id}')">✎ 手写作答</button><button onclick="openEdit('${x.id}')">编辑</button><button onclick="removeQuestion('${x.id}')">删除</button></div>
  </article>`;
}

function enableSelection(){selectionMode=true;$('batchBar').classList.add('show');toast('请勾选需要统一管理的错题')}
function toggleSelection(id,checked){checked?selected.add(id):selected.delete(id);selectionMode=selected.size>0;render()}
function selectAllFiltered(){lastFiltered.forEach(q=>selected.add(q.id));selectionMode=selected.size>0;render();toast(`已选择当前 ${lastFiltered.length} 题`)}
function clearSelection(){selected.clear();selectionMode=false;render()}
function updateBatchBar(){
  const bar=$('batchBar');
  bar.classList.toggle('show',selectionMode||selected.size>0);
  $('selectedCount').textContent=`已选择 ${selected.size} 题`;
  $('batchStatus').value='';
}
function applyBatchStatus(value){if(!value)return;if(!selected.size){toast('请先选择错题');return}qs.forEach(q=>{if(selected.has(q.id)){q.status=value;q.edited=Date.now()}});save();render();toast(`已将 ${selected.size} 题设为${statusLabel[value]}`)}
function openBatchEdit(){if(!selected.size){toast('请先选择错题');return}$('batchTag').value='';$('batchReason').value='';$('batchEditStatus').value='';$('batchOverlay').classList.add('open')}
function closeBatchEdit(){$('batchOverlay').classList.remove('open')}
function saveBatchEdit(){
  if(!selected.size){closeBatchEdit();return}
  const tag=$('batchTag').value.trim(),reason=$('batchReason').value.trim(),st=$('batchEditStatus').value;
  if(!tag&&!reason&&!st){toast('至少填写一项修改内容');return}
  let count=0;qs.forEach(q=>{if(selected.has(q.id)){if(tag)q.tag=tag;if(reason)q.reason=reason;if(st)q.status=st;q.edited=Date.now();count++}});
  save();closeBatchEdit();render();toast(`已批量更新 ${count} 道错题`)
}
function deleteSelected(){if(!selected.size){toast('请先选择错题');return}if(!confirm(`确定删除已选择的 ${selected.size} 道错题吗？此操作无法撤销。`))return;qs=qs.filter(q=>!selected.has(q.id));const count=selected.size;selected.clear();selectionMode=false;save();render();toast(`已删除 ${count} 道错题`)}

function openAdd(){
  editId=null;$('modalTitle').textContent='新增数学错题';
  ['fQ','fA','fTag','fReason'].forEach(id=>$(id).value='');$('fStatus').value='wrong';$('editOverlay').classList.add('open');setTimeout(()=>$('fQ').focus(),100)
}
function openEdit(id){const x=getQuestion(id);if(!x)return;editId=id;$('modalTitle').textContent='编辑数学错题';$('fQ').value=x.q||'';$('fA').value=x.a||'';$('fTag').value=x.tag||'';$('fReason').value=x.reason||'';$('fStatus').value=x.status||'wrong';$('editOverlay').classList.add('open')}
function closeEdit(){$('editOverlay').classList.remove('open')}
function saveQuestion(){
  const text=$('fQ').value.trim();if(!text){toast('请填写题目内容');$('fQ').focus();return}
  const data={q:text,a:$('fA').value.trim(),subject:'数学',tag:$('fTag').value.trim(),reason:$('fReason').value.trim(),status:$('fStatus').value};
  if(editId){const x=getQuestion(editId);if(!x)return;Object.assign(x,data,{edited:Date.now()})}
  else qs.unshift({...data,id:uid(),at:Date.now(),ansImg:null});
  save();closeEdit();render();toast(editId?'错题已更新':'数学错题已添加')
}
function removeQuestion(id){if(!confirm('确定删除这道数学错题吗？'))return;qs=qs.filter(q=>q.id!==id);selected.delete(id);save();render();toast('错题已删除')}

function sourceQuestions(source){
  if(source==='selected')return mathQuestions().filter(q=>selected.has(q.id));
  if(source==='filtered')return [...lastFiltered];
  if(source==='wrong')return mathQuestions().filter(q=>q.status==='wrong');
  return mathQuestions();
}
function openPaperBuilder(preferred){
  const source=preferred==='selected'||selected.size?'selected':lastFiltered.length?'filtered':'wrong';
  $('paperSource').value=source;$('paperTitle').value='数学错题专项练习';$('paperIncludeAnswer').checked=false;
  updatePaperAvailability();$('paperBuilderOverlay').classList.add('open')
}
function closePaperBuilder(){$('paperBuilderOverlay').classList.remove('open')}
function updatePaperAvailability(){
  const list=sourceQuestions($('paperSource').value),max=Math.max(1,list.length),count=$('paperCount');count.max=max;count.value=Math.min(Number(count.value)||10,max);
  $('paperSourceNote').textContent=list.length?`该范围共有 ${list.length} 道题，可自由设置题量。`:'该范围暂时没有题目，请更换题目来源。'
}
function generatePaper(){
  const list=sourceQuestions($('paperSource').value);if(!list.length){toast('当前范围没有可组卷的题目');return}
  const count=Math.min(Math.max(1,Number($('paperCount').value)||list.length),list.length);
  paperQuestions=shuffle([...list]).slice(0,count);renderPaper($('paperTitle').value.trim()||'数学错题专项练习',$('paperIncludeAnswer').checked);closePaperBuilder();$('paperOverlay').classList.add('open')
}
function openPrintPreview(){
  const list=selected.size?sourceQuestions('selected'):lastFiltered;
  if(!list.length){toast('当前没有可以打印的错题');return}
  paperQuestions=[...list];renderPaper('数学错题复习清单',true);$('paperOverlay').classList.add('open')
}
function renderPaper(title,includeAnswers){
  const date=new Date().toLocaleDateString('zh-CN');
  $('paperContent').innerHTML=`<header class="paper-title"><h1>${esc(title)}</h1><div><span>姓名：____________</span><span>日期：${date}</span><span>得分：________</span></div></header>
  <section class="paper-question-list">${paperQuestions.map((q,i)=>`<article><h3>${i+1}. ${esc(q.q)}</h3>${q.tag?`<small>知识点：${esc(q.tag)}</small>`:''}<div class="answer-space"></div></article>`).join('')}</section>
  ${includeAnswers?`<section class="paper-answers"><h2>答案与解析</h2>${paperQuestions.map((q,i)=>`<article><b>${i+1}.</b> ${q.a?esc(q.a):'暂未填写答案'}${q.reason?`<small>出错原因：${esc(q.reason)}</small>`:''}</article>`).join('')}</section>`:''}`
}
function closePaperPreview(){$('paperOverlay').classList.remove('open')}
function printGeneratedPaper(){document.body.classList.add('printing-paper');window.print();setTimeout(()=>document.body.classList.remove('printing-paper'),500)}
function shuffle(arr){for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}

const cv=$('answerCanvas'),ctx=cv.getContext('2d');
function resizeCanvas(){const r=cv.getBoundingClientRect(),d=window.devicePixelRatio||1;cv.width=r.width*d;cv.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);redraw()}
function openDraw(id){drawId=id;strokes=[];const x=getQuestion(id);if(!x)return;$('drawTitle').textContent=(x.tag||'数学错题')+' · 手写作答';$('drawOverlay').classList.add('open');setTimeout(()=>{resizeCanvas();if(x.ansImg){const im=new Image();im.onload=()=>ctx.drawImage(im,0,0,cv.clientWidth,cv.clientHeight);im.src=x.ansImg}},50)}
function closeDraw(){$('drawOverlay').classList.remove('open')}
function setDrawMode(mode){drawMode=mode;toast(mode==='pen'?'已切换钢笔':'已切换橡皮')}
function pos(e){const r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);currentStroke={mode:drawMode,pts:[pos(e)]}});
cv.addEventListener('pointermove',e=>{if(!currentStroke)return;currentStroke.pts.push(pos(e));drawStroke(currentStroke)});
cv.addEventListener('pointerup',()=>{if(currentStroke){strokes.push(currentStroke);currentStroke=null}});
function drawStroke(s){const p=s.pts;if(p.length<2)return;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=s.mode==='eraser'?'white':'#202124';ctx.lineWidth=s.mode==='eraser'?24:3;ctx.beginPath();ctx.moveTo(p[p.length-2].x,p[p.length-2].y);ctx.lineTo(p[p.length-1].x,p[p.length-1].y);ctx.stroke()}
function redraw(){ctx.clearRect(0,0,cv.clientWidth,cv.clientHeight);for(const s of strokes){for(let i=1;i<s.pts.length;i++)drawStroke({mode:s.mode,pts:[s.pts[i-1],s.pts[i]]})}}
function undoStroke(){strokes.pop();redraw()}
function clearCanvas(){if(strokes.length&&confirm('确定清除本次画布吗？')){strokes=[];ctx.clearRect(0,0,cv.clientWidth,cv.clientHeight)}}
function saveDrawing(){const x=getQuestion(drawId);if(x){x.ansImg=cv.toDataURL('image/png');x.edited=Date.now()}save();closeDraw();render();toast('手写作答已保存')}
window.addEventListener('resize',()=>{if($('drawOverlay').classList.contains('open'))resizeCanvas()});
window.addEventListener('afterprint',()=>document.body.classList.remove('printing-paper'));
save();render();
