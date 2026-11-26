'use strict';
// Interface principal: estado, cartão atual, notas, desfazer, biblioteca, edição, importação e backup.
const R=Revisao,KEY='revisao-fiscal-v1',PREV=KEY+'-previous',BOLSO='revisao-de-bolso-2026-11-14';
const $=id=>document.getElementById(id);let s,current,editing,revealed=false,ceAnswer=null,lastUndo=null,session=null;
const notify=t=>$('message').textContent=t;
const el=(tag,props={},...kids)=>{const e=document.createElement(tag);for(const [k,v]of Object.entries(props)){if(k==='class')e.className=v;else if(k==='text')e.textContent=v;else if(k.startsWith('on'))e[k]=v;else e.setAttribute(k,v);}for(const k of kids)if(k!=null)e.append(k);return e;};
try{s=localStorage.getItem(KEY)?R.validateBackup(JSON.parse(localStorage.getItem(KEY))):R.empty();}catch(e){s=null;notify('Dados locais não puderam ser lidos. Exporte os dados brutos antes de restaurar um backup. '+e.message);}
function persist(next){try{localStorage.setItem(KEY,JSON.stringify(next));s=next;render();window.Sync?.changed();window.Dash?.refresh();window.Player?.update();return true;}catch(e){notify('Não foi possível salvar. A operação não foi aplicada: '+e.message);return false;}}
function download(name,data){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function safety(withFile=true){const raw=localStorage.getItem(KEY);if(raw){localStorage.setItem(PREV,raw);if(withFile)download('revisao-fiscal-antes-da-alteracao.json',raw);}}

// ---------- exibição do cartão ----------
const PAT=R.PATTERNS;
function correctionNode(text){
 const p=document.createDocumentFragment();let rest=String(text||'');const re=/\[-(.*?)-\]|\{\+(.*?)\+\}/g;let m,last=0;
 while((m=re.exec(rest))){if(m.index>last)p.append(rest.slice(last,m.index));p.append(m[1]!==undefined?el('del',{text:m[1]}):el('ins',{text:m[2]}));last=re.lastIndex;}
 if(last<rest.length)p.append(rest.slice(last));return p;
}
function tableNode(t){
 const tb=el('table',{class:'pair'}),head=el('tr',{},el('th',{text:'Critério'}),el('th',{text:t.a||'A'}),el('th',{text:t.b||'B'}));tb.append(head);
 for(const r of t.rows)tb.append(el('tr',{},...r.map((x,i)=>el(i?'td':'th',{text:String(x)}))));return tb;
}
function sources(c){$('sources').replaceChildren(...c.sources.map(src=>{const li=el('li');if(/^https?:\/\//.test(src))li.append(el('a',{href:src,target:'_blank',rel:'noopener',text:src.replace(/^https?:\/\/(www\.)?/,'')}));else li.textContent=src;return li;}));}
function patternLabel(c){const p=c.pattern||R.guessPattern(c);return p?('P'+p+' · '+PAT[p]+(c.pattern?'':' (sugerido)')):'';}
function showCard(c){
 current=c;revealed=false;ceAnswer=null;
 $('answer').hidden=true;$('grades').hidden=true;$('hint').hidden=true;
 const isCe=c&&c.type==='ce';
 $('reveal').hidden=!c||isCe;$('ce-choice').hidden=!isCe;$('hint-btn').hidden=!(c&&c.hint);$('edit-current').hidden=!c;
 const pl=c?patternLabel(c):'';$('pattern-chip').hidden=!pl;$('pattern-chip').textContent=pl;
 if(!c)return;
 $('front').textContent=c.front;
 $('cardmeta').textContent=c.subject+' / '+c.topic+(isCe?' · Certo ou Errado?':'')+(c.kind==='complementar'?' · revisão complementar':c.kind==='erro'?' · erro no Tec':'');
 $('hint').textContent=c.hint?'Dica: '+c.hint:'';
 $('back').textContent=isCe?(c.answer+'. '+c.back):c.back;
 $('explanation').textContent=c.explanation||'';
 $('correction').replaceChildren();if(c.correction)$('correction').append(el('span',{class:'eyebrow',text:'CORREÇÃO '}),correctionNode(c.correction));
 $('table').replaceChildren();if(c.type==='par'&&c.table)$('table').append(tableNode(c.table));
 $('law-box').hidden=!c.law;$('law').textContent=c.law||'';
 $('verdict').textContent='';$('verdict').className='verdict';
 sources(c);
}
function reveal(){
 if(!current||revealed)return;revealed=true;
 $('answer').hidden=false;$('grades').hidden=false;$('reveal').hidden=true;$('ce-choice').hidden=true;
 const pv=R.preview(s,current.id);
 document.querySelectorAll('[data-grade]').forEach(b=>{b.querySelector('.when').textContent=R.intervalLabel(pv[b.dataset.grade]);b.classList.remove('suggest');});
 if(current.type==='ce'&&ceAnswer){
  const ok=ceAnswer===current.answer;
  $('verdict').textContent=ok?'Você marcou '+ceAnswer+' e acertou.':'Você marcou '+ceAnswer+', mas o gabarito é '+current.answer+'.';
  $('verdict').className='verdict '+(ok?'ok':'bad');
  document.querySelector(ok?'[data-grade="4"]':'[data-grade="0"]').classList.add('suggest');
 }
 const info=window.Infograficos?.match(current);$('info-link').hidden=!info;$('info-link').onclick=()=>info&&window.Infograficos.open(info);
}
function grade(g){
 if(!current||!s||!revealed)return;
 const id=current.id,before=s,sess=session?structuredClone(session):null;
 const next=R.review(s,id,g);
 if(session)window.Modes?.record(id,g,ceAnswer?ceAnswer===current.answer:null);
 current=null;
 if(persist(next)){lastUndo={before,sess};$('undo').hidden=false;const p=s.progress[id];notify(p.interval===0?'Volta ainda hoje, no fim da fila.':'Revisão salva. Próxima: '+new Date(p.due).toLocaleDateString('pt-BR'));}
}
function undo(){
 if(!lastUndo||!s)return;
 try{const r=R.undo(s,lastUndo.before);if(lastUndo.sess&&window.Modes)window.Modes.restore(lastUndo.sess);lastUndo=null;$('undo').hidden=true;if(persist(r.state)){const c=s.cards.find(x=>x.id===r.cardId);if(c&&!session)showCard(c);notify('Última nota desfeita.');}}catch(e){notify(e.message);}
}

// ---------- revisão do dia ----------
function dayKeep(){return c=>(!$('subject').value||c.subject===$('subject').value)&&(!$('topic').value||c.topic===$('topic').value);}
function render(){
 if(!s)return;
 const filter=$('subject').value,subjects=[...new Set(s.cards.map(c=>c.subject))].sort();
 $('subject').replaceChildren(new Option('Todas as matérias',''),...subjects.map(x=>new Option(x,x)));$('subject').value=subjects.includes(filter)?filter:'';
 const tf=$('topic').value,topics=[...new Set(s.cards.filter(c=>!$('subject').value||c.subject===$('subject').value).map(c=>c.topic))].sort();
 $('topic').replaceChildren(new Option('Todos os assuntos',''),...topics.map(x=>new Option(x,x)));$('topic').value=topics.includes(tf)?tf:'';
 const q=R.queue(s,new Date(),dayKeep()),now=Date.now();
 const dueN=q.filter(c=>s.progress[c.id]?.due&&!R.isLearning(s.progress[c.id])).length,again=q.filter(c=>R.isLearning(s.progress[c.id])).length;
 const today=R.live(s).filter(h=>R.day(h.at)===R.day(new Date())).length;
 $('stats').replaceChildren(...[[dueN,'Vencidos para hoje'],[q.filter(c=>!s.progress[c.id]?.due).length,'Novos liberados'],[again,'Para refazer hoje'],[today,'Revisões hoje']].map(([n,t])=>el('div',{class:'stat'},el('b',{text:String(n)}),el('span',{text:t}))));
 if(session){window.Modes?.render();}
 else{
  const c=q.find(x=>!R.isLearning(s.progress[x.id])||Date.parse(s.progress[x.id].due)<=now)||q[0];
  if(!current||current.id!==c?.id||!revealed)showCard(c);
  if(!c){$('front').textContent=s.cards.length?'Sua fila está em dia.':'Seu primeiro lote começa aqui.';$('cardmeta').textContent=s.cards.length?'VOLTE NA PRÓXIMA REVISÃO':'IMPORTE UM ARQUIVO EM CONTEÚDO E BACKUP';}
  if(window.Foco)Foco.update(q);
 }
 $('limit').value=s.settings.newPerDay;
 $('imports').textContent=s.imports.slice(-5).map(x=>`${new Date(x.at).toLocaleString('pt-BR')} · ${x.batchId}: +${x.added}, ${x.updated} atualizados, ${x.ignored} ignorados${x.skipped?', '+x.skipped+' já cobertos':''}, ${x.conflicts?.length||0} conflitos`).join('\n')||'Nenhum lote importado.';
 library();
}

// ---------- biblioteca ----------
function library(){
 if(!s)return;
 const sel=$('lib-pattern');if(sel.options.length<2)sel.append(...Object.entries(PAT).map(([k,v])=>new Option('P'+k+' · '+v,k)),new Option('Sem padrão','0'));
 const query=$('search').value.toLocaleLowerCase('pt-BR'),pf=sel.value;
 const list=s.cards.filter(c=>[c.front,c.back,c.subject,c.topic].join(' ').toLocaleLowerCase('pt-BR').includes(query)&&(pf===''||String(R.patternOf(c))===pf));
 $('lib-count').textContent=list.length+' de '+s.cards.length+' cartões'+(list.length>150?' (mostrando 150; refine a busca)':'');
 $('cards').replaceChildren(...list.slice(0,150).map(c=>{
  const prog=s.progress[c.id];
  const meta=el('small',{text:c.subject+' · '+c.topic+' · '+(prog?.suspended?'Suspenso':prog?.due?'Revisão: '+new Date(prog.due).toLocaleDateString('pt-BR'):'Novo')+(patternLabel(c)?' · '+patternLabel(c):'')+(prog?.lapses?' · '+prog.lapses+' erro(s)':'')});
  const edit=el('button',{text:'Corrigir',onclick:()=>openEditor(c)});
  const suspend=el('button',{text:prog?.suspended?'Reativar':'Suspender',onclick:()=>{const n=structuredClone(s);n.progress[c.id]={...(n.progress[c.id]||{}),suspended:!prog?.suspended,changedAt:new Date().toISOString()};persist(n);}});
  return el('article',{class:'library-card'},meta,el('h3',{text:c.front}),el('p',{text:c.type==='ce'?c.answer+'. '+c.back:c.back}),edit,suspend);
 }));
}
function openEditor(c){editing=c.id;$('editFront').value=c.front;$('editBack').value=c.back;$('editExplanation').value=c.explanation||'';$('editPattern').value=String(c.pattern||0);$('editor').showModal();}

// ---------- eventos ----------
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!==b.dataset.tab);document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));if(b.dataset.tab==='dash')window.Dash?.refresh();});
$('reveal').onclick=reveal;
document.querySelectorAll('[data-ce]').forEach(b=>b.onclick=()=>{ceAnswer=b.dataset.ce;reveal();});
$('hint-btn').onclick=()=>{$('hint').hidden=false;};
document.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>grade(Number(b.dataset.grade)));
$('undo').onclick=undo;
$('edit-current').onclick=()=>current&&openEditor(current);
$('subject').onchange=()=>{current=null;render();};$('topic').onchange=()=>{current=null;render();};$('search').oninput=library;$('lib-pattern').onchange=library;
document.addEventListener('keydown',e=>{
 if(e.target.closest('input,textarea,select,dialog')||e.ctrlKey&&e.key!=='z'||e.metaKey||e.altKey)return;
 if($('review').hidden)return;
 const k=e.key.toLowerCase();
 if((k===' '||k==='enter')&&current&&!revealed&&current.type!=='ce'&&e.target.tagName!=='BUTTON'){e.preventDefault();reveal();}
 else if((k==='c'||k==='e')&&current&&!revealed&&current.type==='ce'){ceAnswer=k==='c'?'Certo':'Errado';reveal();}
 else if(['1','2','3','4'].includes(k)&&revealed){e.preventDefault();grade([0,3,4,5][Number(k)-1]);}
 else if(k==='u'||(e.ctrlKey&&k==='z')){e.preventDefault();undo();}
 else if(k==='h'&&current?.hint)$('hint').hidden=false;
});
$('saveSettings').onclick=()=>{const n=Number($('limit').value);if(!Number.isInteger(n)||n<0||n>100)return notify('Escolha um número inteiro de 0 a 100.');if(s){const next=structuredClone(s);next.settings.newPerDay=n;next.settings.changedAt=new Date().toISOString();if(persist(next))notify('Limite diário salvo.');}};
$('saveEdit').onclick=e=>{if(!$('editFront').value.trim()||!$('editBack').value.trim()){e.preventDefault();return;}const n=structuredClone(s),c=n.cards.find(c=>c.id===editing);c.front=$('editFront').value.trim();c.back=$('editBack').value.trim();c.explanation=$('editExplanation').value.trim();const pt=Number($('editPattern').value);if(pt)c.pattern=pt;else delete c.pattern;c.localEdited=true;c.editedAt=new Date().toISOString();if(current?.id===c.id)current=null;if(!persist(n))e.preventDefault();};
$('export').onclick=()=>download('revisao-fiscal-backup-'+new Date().toISOString().slice(0,10)+'.json',s||localStorage.getItem(KEY)||'{}');
$('recovery').onclick=()=>{const raw=localStorage.getItem(PREV);raw?download('revisao-fiscal-copia-anterior.json',raw):notify('Não há cópia anterior neste navegador.');};
async function readFile(input){const f=input.files[0];if(!f)return null;if(f.size>20000000)throw Error('Arquivo maior que 20 MB.');return JSON.parse(await f.text());}
$('batch').onchange=async e=>{try{if(!s)throw Error('Restaure um backup válido antes de importar.');const b=await readFile(e.target);if(!b)return;const result=R.importBatch(s,b);safety();if(persist(result.state)){const r=result.result;notify(`${r.added} adicionados; ${r.updated} atualizados; ${r.ignored} ignorados. ${r.conflicts.length?'Conflitos preservados: '+r.conflicts.join('; '):'Histórico preservado.'}`);}}catch(err){notify(err.message);}finally{e.target.value='';}};
$('restore').onchange=async e=>{try{const b=await readFile(e.target);if(!b)return;const v=R.validateBackup(b);if(!confirm('Restaurar '+v.cards.length+' cartões e '+v.history.length+' revisões? Isso substitui os dados deste navegador. A cópia anterior será baixada.'))return;safety();if(persist(v))notify('Backup restaurado.');}catch(err){notify(err.message);}finally{e.target.value='';}};
window.addEventListener('storage',e=>{if(e.key===KEY){try{s=R.validateBackup(JSON.parse(e.newValue));render();notify('Dados atualizados por outra aba.');}catch{notify('Os dados mudaram em outra aba. Reabra o aplicativo.');}}});
function connection(){$('connection').textContent=navigator.onLine?'Dados neste dispositivo':'Offline';}window.addEventListener('online',connection);window.addEventListener('offline',connection);connection();

// ---------- cartões do Revisão de Bolso (uma vez por aparelho) ----------
async function importBolso(){
 if(!s||s.imports.some(i=>i.batchId===BOLSO)||s.settings.bolsoDone)return;
 try{
  const res=await fetch('./lotes/revisao-de-bolso.json');if(!res.ok)return;
  const b=await res.json();if(s.imports.some(i=>i.batchId===BOLSO))return;
  const r=R.importBatch(s,b,{skipSameQuestion:true});safety(false);
  r.state.settings={...r.state.settings,bolsoDone:true,changedAt:new Date().toISOString()};
  if(persist(R.validateBackup(r.state)))notify(`Revisão de Bolso trazido para cá: ${r.result.added} cartões (com o progresso que você já tinha). ${r.result.skipped?r.result.skipped+' ficaram de fora porque a mesma questão do Tec já tinha cartão aqui. ':''}Os vencidos entram aos poucos, no limite diário.`);
 }catch(e){console.warn('Revisão de Bolso',e);}
}
window.App={get state(){return s;},persist,showCard,render,notify,el,reveal,get current(){return current;},setSession(v){session=v;current=null;},get session(){return session;},patternLabel,openEditor};
render();
if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>notify('Cache offline indisponível; mantenha o servidor local aberto.'));
setTimeout(importBolso,1500);
