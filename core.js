(function(root){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const day=d=>new Date(d).toLocaleDateString('en-CA');
function empty(){return {schemaVersion:1,cards:[],progress:{},history:[],settings:{newPerDay:10},imports:[]};}
const DUE_DEFAULT=30;
function dueLimit(s){const m=s.settings&&s.settings.maxDuePerDay;return Number.isInteger(m)&&m>=0?m:DUE_DEFAULT;}
function streak(s,now=new Date()){const days=new Set(s.history.map(h=>day(h.at)));const d=new Date(now);if(!days.has(day(d)))d.setDate(d.getDate()-1);let n=0;while(days.has(day(d))){n++;d.setDate(d.getDate()-1);}return n;}
function validateBatch(b){
 if(!b||b.schemaVersion!==1||!Array.isArray(b.cards)||b.cards.length>10000)throw Error('Lote inválido: schemaVersion deve ser 1 e cards deve ser uma lista.');
 const ids=new Set();
 for(const c of b.cards){
  if(!c||typeof c!=='object')throw Error('Cartão inválido.');
  for(const k of ['id','conceptId','subject','topic','front','back'])if(typeof c[k]!=='string'||!c[k].trim()||c[k].length>20000)throw Error('Campo inválido: '+k);
  if(!/^[a-zA-Z0-9_-]{1,120}$/.test(c.id)||['__proto__','constructor','prototype'].includes(c.id)||ids.has(c.id))throw Error('ID inválido ou duplicado: '+c.id);
  ids.add(c.id);
  if(!Number.isInteger(c.revision)||c.revision<1||!Array.isArray(c.sources)||c.sources.some(s=>typeof s!=='string'))throw Error('Revisão ou fontes inválidas.');
  if(!Number.isFinite(c.priority)||c.priority<0||c.priority>100)throw Error('Prioridade deve estar entre 0 e 100.');
  if(c.kind!==undefined&&!['erro','complementar'].includes(c.kind))throw Error('kind deve ser erro ou complementar.');
 }
 return b;
}
function importBatch(state,b){
 validateBatch(b); const s=clone(state),result={added:0,updated:0,ignored:0,conflicts:[]};
 for(const c of b.cards){
  const i=s.cards.findIndex(x=>x.id===c.id);
  if(i<0){const same=s.cards.find(x=>x.conceptId===c.conceptId);if(same){result.conflicts.push(c.id+': conceito já existe em '+same.id);continue;}s.cards.push(clone(c));result.added++;continue;}
  const old=s.cards[i];
  if(c.revision<=old.revision){result.ignored++;continue;}
  if(old.localEdited||old.conceptId!==c.conceptId||c.changeType!=='wording'){result.conflicts.push(c.id+': edição local ou mudança de conceito; revise manualmente');continue;}
  s.cards[i]=clone(c);result.updated++;
 }
 s.imports.push({at:new Date().toISOString(),batchId:b.batchId||'',...result});return {state:s,result};
}
function queue(s,now=new Date(),keep=()=>true){
 const time=+new Date(now),today=day(now);
 const introduced=new Set(s.history.filter(h=>h.first&&day(h.at)===today).map(h=>h.cardId)).size;
 const active=s.cards.filter(c=>!s.progress[c.id]?.suspended&&keep(c));
 const allDue=active.filter(c=>s.progress[c.id]?.due&&+new Date(s.progress[c.id].due)<=time).sort((a,b)=>+new Date(s.progress[a.id].due)-+new Date(s.progress[b.id].due)||b.priority-a.priority);
 const lim=dueLimit(s),doneDue=s.history.filter(h=>!h.first&&day(h.at)===today).length;
 const due=lim===0?allDue:allDue.slice(0,Math.max(0,lim-doneDue));
 const fresh=active.filter(c=>!s.progress[c.id]?.due).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)).slice(0,Math.max(0,s.settings.newPerDay-introduced));
 return [...due,...fresh];
}
function review(s,id,grade,now=new Date()){
 if(![0,3,4,5].includes(grade)||!s.cards.some(c=>c.id===id))throw Error('Revisão inválida');
 const n=clone(s),p={ease:2.5,interval:0,reps:0,lapses:0,...n.progress[id]};
 if(p.suspended)throw Error('Cartão suspenso.');
 const first=!p.due;
 const ease=Math.max(1.3,p.ease+0.1-(5-grade)*(0.08+(5-grade)*0.02));
 if(grade<3){p.reps=0;p.interval=1;p.lapses++;}else{p.interval=p.reps===0?1:p.reps===1?6:Math.max(1,Math.round(p.interval*p.ease));p.reps++;}
 p.ease=ease;const date=new Date(now);date.setDate(date.getDate()+p.interval);p.due=date.toISOString();p.lastReview=new Date(now).toISOString();
 n.progress[id]=p;n.history.push({cardId:id,at:p.lastReview,grade,first,interval:p.interval});return n;
}
function validateBackup(s){
 if(!s||s.schemaVersion!==1||!s.progress||typeof s.progress!=='object'||Array.isArray(s.progress)||!Array.isArray(s.history)||!Array.isArray(s.imports)||!Number.isInteger(s.settings?.newPerDay)||s.settings.newPerDay<0||s.settings.newPerDay>100||(s.settings.maxDuePerDay!==undefined&&(!Number.isInteger(s.settings.maxDuePerDay)||s.settings.maxDuePerDay<0||s.settings.maxDuePerDay>500)))throw Error('Backup inválido');
 validateBatch(s);const ids=new Set(s.cards.map(c=>c.id));
 for(const [id,p]of Object.entries(s.progress)){if(!ids.has(id)||!p||typeof p!=='object')throw Error('Histórico sem cartão');if(p.due&&(!Number.isFinite(Date.parse(p.due))||!Number.isFinite(p.ease)||p.ease<1.3||!Number.isInteger(p.reps)||p.reps<0||!Number.isInteger(p.interval)||p.interval<1||!Number.isInteger(p.lapses)||p.lapses<0))throw Error('Agendamento inválido');}
 for(const h of s.history)if(!ids.has(h.cardId)||!Number.isFinite(Date.parse(h.at))||![0,3,4,5].includes(h.grade)||typeof h.first!=='boolean')throw Error('Histórico inválido');
 return s;
}
const api={empty,validateBatch,importBatch,queue,review,validateBackup,day,dueLimit,streak,DUE_DEFAULT};if(typeof module!=='undefined')module.exports=api;else root.Revisao=api;
})(globalThis);
