(function(){
  'use strict';

  const APP_ID='dudu-cuotuiben';
  const PAGE=document.querySelector('.app-shell')?'math':document.querySelector('.eng-shell')?'english':'';

  function transferUid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
  function notify(message){if(typeof toast==='function')toast(message);else alert(message)}
  function stamp(){return new Date().toISOString().slice(0,10)}
  function downloadJson(payload,filename){
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),800);
  }
  async function readJsonFile(file){
    if(!file)throw new Error('请先选择备份文件');
    if(file.size>35*1024*1024)throw new Error('备份文件超过 35MB，浏览器可能无法安全导入');
    try{return JSON.parse(await file.text())}catch{throw new Error('文件不是有效的 JSON 备份')}
  }

  function ensureDialog(){
    let overlay=document.getElementById('dataTransferOverlay');
    if(overlay)return overlay;
    overlay=document.createElement('div');
    overlay.id='dataTransferOverlay';overlay.className='data-overlay';
    overlay.innerHTML='<section class="data-modal" role="dialog" aria-modal="true" aria-labelledby="dataTransferTitle"><header><div><h2 id="dataTransferTitle"></h2><p id="dataTransferSubtitle"></p></div><button class="data-close" type="button" aria-label="关闭" onclick="closeDataTransfer()">×</button></header><div class="data-modal-body" id="dataTransferBody"></div></section>';
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeDataTransfer()});
    document.body.appendChild(overlay);return overlay;
  }
  function openDialog(title,subtitle,body){
    const overlay=ensureDialog();
    document.getElementById('dataTransferTitle').textContent=title;
    document.getElementById('dataTransferSubtitle').textContent=subtitle||'';
    document.getElementById('dataTransferBody').innerHTML=body;
    overlay.classList.add('open');document.body.classList.add('data-modal-open');
    setTimeout(()=>overlay.querySelector('input,textarea,select,button')?.focus(),60);
  }
  window.closeDataTransfer=function(){document.getElementById('dataTransferOverlay')?.classList.remove('open');document.body.classList.remove('data-modal-open')};
  function setStatusText(text,type=''){const el=document.getElementById('dataTransferStatus');if(!el)return;el.textContent=text;el.className='data-status '+type}
  function modeMarkup(prefix){return '<div class="data-mode"><label><input type="radio" name="'+prefix+'Mode" value="merge" checked><span><b>合并导入</b><small>保留现有内容，自动去重并更新重复项目</small></span></label><label><input type="radio" name="'+prefix+'Mode" value="replace"><span><b>覆盖恢复</b><small>清空当前模块数据，完全恢复为备份内容</small></span></label></div>'}

  function mathFingerprint(item){return [item.q||'',item.a||'',item.tag||''].join('\u0001').trim().toLowerCase()}
  function normalizeMathItem(raw){
    if(!raw||typeof raw!=='object')return null;
    const question=String(raw.q??raw.question??'').trim();if(!question)return null;
    const state=['wrong','review','done'].includes(raw.status)?raw.status:'wrong';
    return {id:String(raw.id||transferUid()),q:question,a:String(raw.a??raw.answer??'').trim(),subject:'数学',tag:String(raw.tag??raw.chapter??'').trim(),reason:String(raw.reason??'').trim(),status:state,at:Number(raw.at)||Date.now(),edited:Number(raw.edited)||Number(raw.at)||Date.now(),ansImg:typeof raw.ansImg==='string'?raw.ansImg:null};
  }

  window.exportMathData=function(){
    if(typeof mathQuestions!=='function'){notify('数学数据尚未加载');return}
    const payload={app:APP_ID,version:1,type:'math',exportedAt:new Date().toISOString(),questions:mathQuestions()};
    downloadJson(payload,'dudu-math-backup-'+stamp()+'.json');notify('数学错题备份已导出');
  };
  window.openMathImport=function(){
    openDialog('导入数学错题','支持本站导出的 JSON 备份；导入前建议先导出一次当前数据。','<div class="data-note"><b>导入内容：</b>题目、答案、知识点、出错原因、掌握状态和手写作答都会保留。</div><label class="data-file"><span>选择 .json 备份文件</span><input id="mathImportFile" type="file" accept=".json,application/json"></label>'+modeMarkup('math')+'<div class="data-status" id="dataTransferStatus">尚未选择文件</div><div class="data-footer"><button class="data-secondary" type="button" onclick="closeDataTransfer()">取消</button><button class="data-primary" id="mathImportBtn" type="button" onclick="runMathImport()">开始导入</button></div>');
    document.getElementById('mathImportFile').addEventListener('change',e=>setStatusText(e.target.files[0]?e.target.files[0].name:'尚未选择文件'));
  };
  window.runMathImport=async function(){
    const button=document.getElementById('mathImportBtn');button.disabled=true;
    try{
      const payload=await readJsonFile(document.getElementById('mathImportFile').files[0]);
      const source=Array.isArray(payload)?payload:payload?.questions;
      if(!Array.isArray(source))throw new Error('这个文件中没有找到数学错题数据');
      const imported=source.map(normalizeMathItem).filter(Boolean);
      if(!imported.length)throw new Error('文件中没有可导入的有效题目');
      const mode=document.querySelector('input[name="mathMode"]:checked')?.value||'merge';
      let added=0,updated=0;
      if(mode==='replace'){
        const other=qs.filter(item=>item.subject!=='数学');qs=[...imported,...other];added=imported.length;
      }else{
        imported.forEach(item=>{
          const fingerprint=mathFingerprint(item);
          const index=qs.findIndex(old=>old.subject==='数学'&&(String(old.id)===String(item.id)||mathFingerprint(old)===fingerprint));
          if(index>=0){const old=qs[index];qs[index]={...old,...item,id:old.id,subject:'数学'};updated++}
          else{qs.unshift(item);added++}
        });
      }
      save();render();closeDataTransfer();notify(mode==='replace'?`已恢复 ${added} 道数学错题`:`已导入 ${added} 道，更新 ${updated} 道`);
    }catch(error){setStatusText(error.message||'导入失败','error')}finally{button.disabled=false}
  };

  function cleanEnglishBackup(payload){
    const rawWords=Array.isArray(payload)?payload:payload?.words;
    if(!Array.isArray(rawWords))throw new Error('这个文件中没有找到英语单词数据');
    const importedWords=rawWords.map(item=>normalizeWord(item)).filter(item=>/^[a-z][a-z'-]*$/.test(item.word));
    if(!importedWords.length)throw new Error('文件中没有可导入的有效英语单词');
    return {words:importedWords,history:Array.isArray(payload?.history)?payload.history:[],daily:payload?.daily&&typeof payload.daily==='object'&&!Array.isArray(payload.daily)?payload.daily:{},settings:payload?.settings&&typeof payload.settings==='object'?payload.settings:{}};
  }
  function mergeWordProgress(existing,incoming){
    const progress=(Number(incoming.seen)||0)>(Number(existing.seen)||0)?incoming:existing;
    const merged={...existing,...incoming,id:existing.id,createdAt:Math.min(Number(existing.createdAt)||Date.now(),Number(incoming.createdAt)||Date.now()),seen:Number(progress.seen)||0,correct:Number(progress.correct)||0,level:Number(progress.level)||0,due:Number(progress.due)||0,weak:!!(existing.weak||incoming.weak),lapses:Number(progress.lapses)||0,spellStreak:Number(progress.spellStreak)||0,introducedDay:progress.introducedDay??null,lastStudiedAt:Math.max(Number(existing.lastStudiedAt)||0,Number(incoming.lastStudiedAt)||0)||null};
    merged.correct=Math.min(merged.correct,merged.seen);return merged;
  }
  function mergeHistory(current,incoming){
    const out=[],seen=new Set();
    [...current,...incoming].forEach(item=>{if(!item||typeof item!=='object')return;const key=[item.wordId||item.word||'',item.type||'',item.at||item.time||item.createdAt||'',item.correct].join('|');if(seen.has(key))return;seen.add(key);out.push(item)});
    return out.sort((a,b)=>(Number(a.at||a.time||a.createdAt)||0)-(Number(b.at||b.time||b.createdAt)||0)).slice(-3000);
  }
  function mergeDaily(current,incoming){
    const out={...current};
    Object.entries(incoming||{}).forEach(([key,value])=>{if(!value||typeof value!=='object')return;const old=out[key]||{};out[key]={activities:Math.max(Number(old.activities)||0,Number(value.activities)||0),correct:Math.max(Number(old.correct)||0,Number(value.correct)||0),sessions:Math.max(Number(old.sessions)||0,Number(value.sessions)||0),newWords:Math.max(Number(old.newWords)||0,Number(value.newWords)||0)}});return out;
  }

  window.exportEnglishData=function(){
    if(typeof words==='undefined'){notify('英语数据尚未加载');return}
    const payload={app:APP_ID,version:1,type:'english',exportedAt:new Date().toISOString(),words,history,daily,settings};
    downloadJson(payload,'dudu-english-backup-'+stamp()+'.json');notify('英语学习备份已导出');
  };
  window.openEnglishBackupImport=function(){
    openDialog('导入英语学习备份','恢复单词、熟练度、听写记录、每日进度和学习设置。','<div class="data-note"><b>完整恢复：</b>这不是普通词表导入，而是用于换电脑、清理浏览器前后的完整备份恢复。</div><label class="data-file"><span>选择 .json 备份文件</span><input id="englishImportFile" type="file" accept=".json,application/json"></label>'+modeMarkup('english')+'<div class="data-status" id="dataTransferStatus">尚未选择文件</div><div class="data-footer"><button class="data-secondary" type="button" onclick="closeDataTransfer()">取消</button><button class="data-primary" id="englishImportBtn" type="button" onclick="runEnglishBackupImport()">开始导入</button></div>');
    document.getElementById('englishImportFile').addEventListener('change',e=>setStatusText(e.target.files[0]?e.target.files[0].name:'尚未选择文件'));
  };
  window.runEnglishBackupImport=async function(){
    const button=document.getElementById('englishImportBtn');button.disabled=true;
    try{
      const payload=await readJsonFile(document.getElementById('englishImportFile').files[0]),data=cleanEnglishBackup(payload),mode=document.querySelector('input[name="englishMode"]:checked')?.value||'merge';
      let added=0,updated=0;
      if(mode==='replace'){
        words=data.words;history=data.history;daily=data.daily;settings={dailyLimit:8,...data.settings};added=words.length;
      }else{
        const map=new Map(words.map((item,index)=>[item.word,index]));
        data.words.forEach(item=>{const index=map.get(item.word);if(index===undefined){map.set(item.word,words.length);words.push(item);added++}else{words[index]=mergeWordProgress(words[index],item);updated++}});
        history=mergeHistory(history,data.history);daily=mergeDaily(daily,data.daily);
        if(Number(data.settings.dailyLimit))settings.dailyLimit=Number(data.settings.dailyLimit);
      }
      persist();render();closeDataTransfer();notify(mode==='replace'?`已恢复 ${added} 个英语单词及学习记录`:`已导入 ${added} 个，更新 ${updated} 个`);
    }catch(error){setStatusText(error.message||'导入失败','error')}finally{button.disabled=false}
  };

  function parseBatchText(text){
    const byWord=new Map(),invalid=[];
    text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).forEach((line,lineIndex)=>{
      if(lineIndex===0&&/^(word|english|单词)(\s|,|，|\t|\|)/i.test(line))return;
      let first=line,meaning='';
      const delimiter=line.match(/[\t,，|;]/);
      if(delimiter){const index=delimiter.index;first=line.slice(0,index).trim();meaning=line.slice(index+1).trim()}
      else{const match=line.match(/^([A-Za-z][A-Za-z'-]*)(?:\s+(.+))?$/);if(match){first=match[1];meaning=(match[2]||'').trim()}}
      const word=String(first).toLowerCase().trim();
      if(!/^[a-z][a-z'-]*$/.test(word)){invalid.push(line);return}
      const old=byWord.get(word);byWord.set(word,{word,meaning:meaning||old?.meaning||'',order:old?.order??lineIndex});
    });
    return {entries:[...byWord.values()].sort((a,b)=>a.order-b.order),invalid};
  }
  async function enrichBatchEntry(entry,source,shouldEnrich){
    let meaning=entry.meaning||LOCAL_ZH[entry.word]||'',phonetic='',audio='',englishDefinition='',example='',numSyllables;
    if(shouldEnrich){
      const raw=entry.word;
      const dictP=withTimeout('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(raw)).then(r=>r.ok?r.json():null).catch(()=>null);
      const dmP=withTimeout('https://api.datamuse.com/words?sp='+encodeURIComponent(raw)+'&qe=sp&md=rs&ipa=1&max=1').then(r=>r.ok?r.json():null).catch(()=>null);
      const zhP=meaning?Promise.resolve(null):withTimeout('https://api.mymemory.translated.net/get?q='+encodeURIComponent(raw)+'&langpair=en|zh-CN').then(r=>r.ok?r.json():null).catch(()=>null);
      const [dict,dm,zh]=await Promise.all([dictP,dmP,zhP]),dictEntry=Array.isArray(dict)?dict[0]:null,meta=Array.isArray(dm)?dm.find(x=>x.word?.toLowerCase()===raw)||dm[0]:null;
      const foundPhonetic=(dictEntry?.phonetics||[]).find(p=>p.text)?.text||dictEntry?.phonetic||((meta?.tags||[]).find(t=>t.startsWith('pron:'))?.slice(5))||'';
      phonetic=foundPhonetic?'/'+foundPhonetic.replace(/^\/|\/$/g,'')+'/':'';
      audio=(dictEntry?.phonetics||[]).find(p=>p.audio)?.audio||'';if(audio.startsWith('//'))audio='https:'+audio;
      englishDefinition=dictEntry?.meanings?.[0]?.definitions?.[0]?.definition||'';
      example=dictEntry?.meanings?.flatMap(m=>m.definitions||[]).find(d=>d.example)?.example||'';
      const translated=zh?.responseData?.translatedText||'';if(!meaning&&translated&&translated.toLowerCase()!==raw)meaning=translated;
      numSyllables=meta?.numSyllables;
    }
    if(!meaning)return null;
    const analysis=buildAnalysis(entry.word,numSyllables);
    return normalizeWord({word:entry.word,meaning,phonetic,audio,source,sourceName:shouldEnrich?'批量智能导入':'批量快速导入',englishDefinition,example,numSyllables,syllables:analysis.syllables,chunks:analysis.chunks,phonicsTip:analysis.tip,isIrregular:analysis.isIrregular});
  }
  function updateWordMetadata(existing,incoming){
    ['meaning','phonetic','audio','source','sourceName','englishDefinition','example','syllables','chunks','phonicsTip','isIrregular'].forEach(key=>{if(incoming[key]!==''&&incoming[key]!=null)existing[key]=incoming[key]});return existing;
  }

  window.openEnglishBatchImport=function(){
    openDialog('批量导入英语单词','可以继续一个个智能添加，也可以把老师词表或课本词表一次性粘贴进来。','<div class="data-format"><b>支持格式</b><code>apple</code><code>apple 苹果</code><code>apple,苹果</code><code>apple\t苹果</code></div><label class="data-file batch-file"><span>也可以选择 TXT / CSV 词表</span><input id="batchTextFile" type="file" accept=".txt,.csv,text/plain,text/csv"></label><textarea class="batch-textarea" id="batchWordText" rows="11" placeholder="每行一个单词，例如：\napple 苹果\nbeautiful 美丽的\nquestion 问题"></textarea><div class="data-grid"><label>单词来源<select id="batchSource"><option>课本</option><option>老师词表</option><option>英语错题</option><option>手动添加</option></select></label><label>遇到重复单词<select id="batchDuplicate"><option value="skip">跳过重复</option><option value="update">更新释义和拼读信息</option></select></label></div><label class="data-check"><input id="batchEnrich" type="checkbox" checked><span><b>自动补全缺失的中文释义、音标和发音</b><small>需要联网，建议每次导入不超过 50 个；已有中文释义的词会更快。</small></span></label><div class="data-status" id="dataTransferStatus">等待粘贴词表</div><div class="data-footer"><button class="data-secondary" type="button" onclick="closeDataTransfer()">取消</button><button class="data-primary" id="batchImportBtn" type="button" onclick="runEnglishBatchImport()">批量导入</button></div>');
    document.getElementById('batchTextFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{document.getElementById('batchWordText').value=await file.text();setStatusText(`已读取 ${file.name}`)}catch{setStatusText('词表文件读取失败','error')}});
  };
  window.runEnglishBatchImport=async function(){
    const button=document.getElementById('batchImportBtn'),text=document.getElementById('batchWordText').value,{entries,invalid}=parseBatchText(text);
    if(!entries.length){setStatusText('没有识别到有效英文单词，请检查格式','error');return}
    const enrich=document.getElementById('batchEnrich').checked,limit=enrich?60:200;
    if(entries.length>limit){setStatusText(`本次最多处理 ${limit} 个单词，请分批导入`,'error');return}
    button.disabled=true;button.textContent='正在处理…';
    const source=document.getElementById('batchSource').value,duplicateMode=document.getElementById('batchDuplicate').value,existingMap=new Map(words.map((item,index)=>[item.word,index]));
    const newItems=[],failed=[],stats={done:0,added:0,updated:0,skipped:0};let cursor=0;
    async function worker(){
      while(true){const index=cursor++;if(index>=entries.length)return;const entry=entries[index],existingIndex=existingMap.get(entry.word);
        if(existingIndex!==undefined&&duplicateMode==='skip'){stats.skipped++;stats.done++;setStatusText(`正在处理 ${stats.done} / ${entries.length}…`);continue}
        try{
          const item=await enrichBatchEntry(entry,source,enrich);
          if(!item){failed.push(entry.word);stats.done++;setStatusText(`正在处理 ${stats.done} / ${entries.length}…`);continue}
          if(existingIndex!==undefined){words[existingIndex]=updateWordMetadata(words[existingIndex],item);stats.updated++}
          else{newItems.push({order:entry.order,item});existingMap.set(entry.word,-1);stats.added++}
        }catch{failed.push(entry.word)}
        stats.done++;setStatusText(`正在处理 ${stats.done} / ${entries.length}…`);
      }
    }
    try{
      await Promise.all(Array.from({length:Math.min(3,entries.length)},()=>worker()));
      newItems.sort((a,b)=>a.order-b.order);words=[...newItems.map(x=>x.item),...words];persist();render();
      const summary=`新增 ${stats.added} 个，更新 ${stats.updated} 个，跳过 ${stats.skipped} 个`;
      if(failed.length||invalid.length){const retry=[...failed,...invalid].slice(0,20);document.getElementById('batchWordText').value=retry.join('\n');setStatusText(`${summary}；${failed.length+invalid.length} 项未导入，请补充中文释义后重试。`,'warning');notify('批量导入已完成，仍有少量项目需要补充')}
      else{closeDataTransfer();notify('批量导入完成：'+summary)}
    }finally{button.disabled=false;button.textContent='批量导入'}
  };

})();
