(function(root){
'use strict';
// Núcleo do Revisão Fiscal: validação, importação, fila e agendamento FSRS-5.
// Funções puras: recebem o estado e devolvem um estado novo.
const clone=x=>JSON.parse(JSON.stringify(x));
const day=d=>new Date(d).toLocaleDateString('en-CA');
const DAY=864e5,MIN=6e4;
const DUE_DEFAULT=30,RETENTION=0.9,MAX_INTERVAL=90;

// ---------- FSRS-5 (parâmetros padrão) ----------
const W=[0.40255,1.18385,3.173,15.69105,7.1949,0.5345,1.4604,0.0046,1.54575,0.1192,1.01925,1.9395,0.11,0.29605,2.2698,0.2315,2.9898,0.51655,0.6621];
const DECAY=-0.5,FACTOR=19/81;
const clampD=d=>Math.min(10,Math.max(1,d));
const retr=(t,s)=>Math.pow(1+FACTOR*t/s,DECAY);
const interval=s=>Math.min(MAX_INTERVAL,Math.max(1,Math.round(s/FACTOR*(Math.pow(RETENTION,1/DECAY)-1))));
const d0=g=>clampD(W[4]-Math.exp(W[5]*(g-1))+1);
// Notas do app (0, 3, 4, 5) → notas FSRS (1 errei, 2 difícil, 3 bom, 4 fácil)
const RATING={0:1,3:2,4:3,5:4};
const GRADES=[0,3,4,5];
const LEECH=4;

function nextState(p,grade,now){
 const g=RATING[grade],t=+new Date(now),out={...p};
 out.reps=(p.reps||0)+1;out.lastReview=new Date(t).toISOString();
 let s,d,learning=false;
 if(!Number.isFinite(p.s)){ // cartão novo
  s=W[g-1];d=d0(g);learning=g===1;
 }else{
  const last=Date.parse(p.lastReview||p.due||t);
  const elapsed=Math.max(0,(t-last)/DAY);
  d=clampD((()=>{const dd=p.d+(-W[6]*(g-3))*(10-p.d)/9;return W[7]*d0(4)+(1-W[7])*dd;})());
  if(elapsed<1){ // revisão no mesmo dia (reaprendizado)
   s=Math.max(0.1,p.s*Math.exp(W[17]*(g-3+W[18])));
   learning=g===1;
  }else{
   const r=retr(elapsed,p.s);
   if(g===1){
    s=Math.min(p.s,W[11]*Math.pow(d,-W[12])*(Math.pow(p.s+1,W[13])-1)*Math.exp(W[14]*(1-r)));
    learning=true;
   }else{
    const hard=g===2?W[15]:1,easy=g===4?W[16]:1;
    s=p.s*(Math.exp(W[8])*(11-d)*Math.pow(p.s,-W[9])*(Math.exp(W[10]*(1-r))-1)*hard*easy+1);
   }
  }
 }
 out.s=+s.toFixed(4);out.d=+d.toFixed(4);
 if(g===1&&Number.isFinite(p.s)&&p.state!=='learning'&&p.state!=='relearning')out.lapses=(p.lapses||0)+1;
 else out.lapses=p.lapses||0;
 if(learning){ // volta na mesma sessão, no fim da fila
  out.state=Number.isFinite(p.s)?'relearning':'learning';out.interval=0;
  out.due=new Date(t+MIN).toISOString();
 }else{
  out.state='review';out.interval=interval(out.s);
  const due=new Date(t);due.setDate(due.getDate()+out.interval);out.due=due.toISOString();
 }
 delete out.ease;
 return out;
}
// Quando o cartão volta para cada nota, sem alterar nada
function preview(s,id,now=new Date()){
 const p=s.progress[id]||{},o={};
 for(const g of GRADES){const n=nextState(p,g,now);o[g]=n.interval;}
 return o;
}
const intervalLabel=n=>n===0?'agora':n===1?'amanhã':n<30?n+' dias':n<365?Math.round(n/30)+(Math.round(n/30)===1?' mês':' meses'):Math.round(n/365)+' ano(s)';

// ---------- migração (SM-2 → FSRS) ----------
// Idempotente: só converte entradas antigas (com ease e sem s).
function migrateProgress(p){
 if(!p||typeof p!=='object'||Number.isFinite(p.s)||!p.due)return p;
 const out={...p};
 out.s=Math.max(1,Number(p.interval)||1);
 out.d=clampD(5+(2.5-(Number(p.ease)||2.5))*3.3);
 out.state='review';out.migratedFrom='sm2';delete out.ease;
 if(!out.lastReview){const d=new Date(p.due);d.setDate(d.getDate()-Math.round(out.s));out.lastReview=d.toISOString();}
 return out;
}
function migrate(state){
 let changed=false;const s={...state,progress:{...state.progress}};
 for(const [id,p]of Object.entries(s.progress)){const m=migrateProgress(p);if(m!==p){s.progress[id]=m;changed=true;}}
 if(!s.settings)s.settings={newPerDay:10};
 return changed?s:state;
}

// ---------- padrões de erro ----------
const PATTERNS={1:'Troca entre vizinhos',2:'Palavra ou número trocado',3:'Regra geral sem exceção',4:'Sentido invertido',5:'Cálculo em etapas'};
const corrParts=c=>{const a=[],b=[];String(c||'').replace(/\[-(.*?)-\]/g,(_,x)=>a.push(x)).replace(/\{\+(.*?)\+\}/g,(_,x)=>b.push(x));return [a.join(' '),b.join(' ')];};
const norm=x=>String(x||'').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g,'');
// Sugestão automática quando o cartão não traz o padrão. Mostrada como "sugerido".
function guessPattern(c){
 const f=norm(c.front),b=norm(c.back),[rem,add]=corrParts(c.correction).map(norm);
 if(c.type==='par')return 1;
 const calc=/\d/.test(f)&&(/(r\$|\bmil\b|\bmi\b|%)/.test(f))&&/(qual|calcul|despesa|ganho|resultado|saldo|fica em|reconhece \d|o ativo fica)/.test(f);
 if(calc)return 5;
 if(rem||add){
  if(/\d/.test(rem)&&/\d/.test(add))return 2;
  const neg=x=>x.replace(/\bnao\b\s*/g,'').replace(/\bin(?=dependente|depende)/g,'').trim();
  const opp=[['maior','menor'],['aumenta','reduz'],['sobe','cai'],['contratado','contratante'],['seguranca','inseguranca'],['depende','independe'],['antes','depois'],['ex tunc','ex nunc'],['solidari','subsidiari'],['vinculado','discricionario'],['constitucional','inconstitucional']];
  if((/\bnao\b/.test(rem)!==/\bnao\b/.test(add)&&neg(rem)&&(add.includes(neg(rem))||rem.includes(neg(add))))||opp.some(([x,y])=>(rem.includes(x)&&add.includes(y))||(rem.includes(y)&&add.includes(x))))return 4;
  if(/\b(so|apenas|sempre|todos|todas|qualquer|nenhum|exclusivamente|automaticamente|a qualquer tempo|em qualquer)\b/.test(rem))return 3;
  return 1;
 }
 if(/ × | x |\bou\b.*\?$/.test(f)||/nao confundir/.test(b))return 1;
 if(/\b(salvo|exceto|excecao|so se|somente)\b/.test(b))return 3;
 return 0;
}
const patternOf=c=>c.pattern||guessPattern(c)||0;

// ---------- validação ----------
function validateCard(c,ids){
 if(!c||typeof c!=='object')throw Error('Cartão inválido.');
 for(const k of ['id','conceptId','subject','topic','front','back'])if(typeof c[k]!=='string'||!c[k].trim()||c[k].length>20000)throw Error('Campo inválido: '+k);
 if(!/^[a-zA-Z0-9_-]{1,120}$/.test(c.id)||['__proto__','constructor','prototype'].includes(c.id)||ids.has(c.id))throw Error('ID inválido ou duplicado: '+c.id);
 ids.add(c.id);
 if(!Number.isInteger(c.revision)||c.revision<1||!Array.isArray(c.sources)||c.sources.some(s=>typeof s!=='string'))throw Error('Revisão ou fontes inválidas.');
 if(!Number.isFinite(c.priority)||c.priority<0||c.priority>100)throw Error('Prioridade deve estar entre 0 e 100.');
 if(c.kind!==undefined&&!['erro','complementar'].includes(c.kind))throw Error('kind deve ser erro ou complementar.');
 if(c.type!==undefined&&!['ce','par'].includes(c.type))throw Error('type deve ser ce ou par: '+c.id);
 if(c.type==='ce'&&!['Certo','Errado'].includes(c.answer))throw Error('Cartão Certo/Errado sem gabarito: '+c.id);
 if(c.type==='par'&&!(c.table&&Array.isArray(c.table.rows)))throw Error('Cartão de contraste sem tabela: '+c.id);
 if(c.pattern!==undefined&&!(Number.isInteger(c.pattern)&&c.pattern>=1&&c.pattern<=5))throw Error('pattern deve ser de 1 a 5: '+c.id);
 if(c.lessons!==undefined&&!(Array.isArray(c.lessons)&&c.lessons.every(x=>typeof x==='string')))throw Error('lessons deve ser lista: '+c.id);
}
function validateBatch(b){
 if(!b||b.schemaVersion!==1||!Array.isArray(b.cards)||b.cards.length>10000)throw Error('Lote inválido: schemaVersion deve ser 1 e cards deve ser uma lista.');
 const ids=new Set();for(const c of b.cards)validateCard(c,ids);
 return b;
}
function validProgress(p){
 if(!p||typeof p!=='object')return false;
 if(!p.due)return true;
 if(!Number.isFinite(Date.parse(p.due)))return false;
 if(Number.isFinite(p.s))return p.s>0&&Number.isFinite(p.d)&&p.d>=1&&p.d<=10;
 return Number.isFinite(p.ease); // formato antigo, migrado na leitura
}
function validateBackup(s){
 if(!s||s.schemaVersion!==1||!s.progress||typeof s.progress!=='object'||Array.isArray(s.progress)||!Array.isArray(s.history)||!Array.isArray(s.imports)||!Number.isInteger(s.settings?.newPerDay)||s.settings.newPerDay<0||s.settings.newPerDay>100||(s.settings.maxDuePerDay!==undefined&&(!Number.isInteger(s.settings.maxDuePerDay)||s.settings.maxDuePerDay<0||s.settings.maxDuePerDay>500)))throw Error('Backup inválido');
 validateBatch(s);const ids=new Set(s.cards.map(c=>c.id));
 for(const [id,p]of Object.entries(s.progress)){if(!ids.has(id))throw Error('Histórico sem cartão');if(!validProgress(p))throw Error('Agendamento inválido: '+id);}
 for(const h of s.history)if(!ids.has(h.cardId)||!Number.isFinite(Date.parse(h.at))||!GRADES.includes(h.grade)||typeof h.first!=='boolean')throw Error('Histórico inválido');
 return migrate(s);
}

// ---------- estado, importação ----------
function empty(){return {schemaVersion:1,cards:[],progress:{},history:[],settings:{newPerDay:10},imports:[]};}
const live=s=>s.history.filter(h=>!h.undone);
const dueLimit=s=>{const m=s.settings&&s.settings.maxDuePerDay;return Number.isInteger(m)&&m>=0?m:DUE_DEFAULT;};
function streak(s,now=new Date()){const days=new Set(live(s).map(h=>day(h.at)));const d=new Date(now);if(!days.has(day(d)))d.setDate(d.getDate()-1);let n=0;while(days.has(day(d))){n++;d.setDate(d.getDate()-1);}return n;}
const tecIds=c=>new Set([...(c.sources||[]),c.link||''].join(' ').match(/(?:questoes\/|quest[aã]o\s*(?:n[º°o.]*\s*)?|\btec\s*(?:concursos)?\s*[#:nº°.]*\s*)(\d{5,8})/gi)?.map(x=>x.replace(/\D/g,''))||[]);
// opts.skipSameQuestion: não traz cartão de uma questão do Tec que já tem cartão no app
function importBatch(state,b,opts={}){
 validateBatch(b);const s=clone(state),result={added:0,updated:0,ignored:0,skipped:0,conflicts:[]};
 const known=new Set();if(opts.skipSameQuestion)for(const c of s.cards)for(const q of tecIds(c))known.add(q);
 for(const c of b.cards){
  const i=s.cards.findIndex(x=>x.id===c.id);
  if(i<0){
   const same=s.cards.find(x=>x.conceptId===c.conceptId);
   if(same){result.conflicts.push(c.id+': conceito já existe em '+same.id);continue;}
   if(opts.skipSameQuestion&&[...tecIds(c)].some(q=>known.has(q))){result.skipped++;continue;}
   s.cards.push(clone(c));result.added++;
   const p=b.progress&&b.progress[c.id];
   if(p&&!s.progress[c.id]&&validProgress(p))s.progress[c.id]=clone(p);
   continue;
  }
  const old=s.cards[i];
  if(c.revision<=old.revision){result.ignored++;continue;}
  if(old.localEdited||old.conceptId!==c.conceptId||c.changeType!=='wording'){result.conflicts.push(c.id+': edição local ou mudança de conceito; revise manualmente');continue;}
  s.cards[i]=clone(c);result.updated++;
 }
 s.imports.push({at:new Date().toISOString(),batchId:b.batchId||'',...result});return {state:s,result};
}

// ---------- fila ----------
const isLearning=p=>p&&(p.state==='learning'||p.state==='relearning');
function queue(s,now=new Date(),keep=()=>true){
 const time=+new Date(now),today=day(now),h=live(s);
 const introduced=new Set(h.filter(x=>x.first&&day(x.at)===today).map(x=>x.cardId)).size;
 const active=s.cards.filter(c=>!s.progress[c.id]?.suspended&&keep(c));
 const P=c=>s.progress[c.id];
 const learning=active.filter(c=>isLearning(P(c))&&day(P(c).due)<=today).sort((a,b)=>Date.parse(P(a).due)-Date.parse(P(b).due));
 const allDue=active.filter(c=>P(c)?.due&&!isLearning(P(c))&&+new Date(P(c).due)<=time).sort((a,b)=>Date.parse(P(a).due)-Date.parse(P(b).due)||b.priority-a.priority);
 const lim=dueLimit(s),doneDue=h.filter(x=>!x.first&&!x.relearn&&day(x.at)===today).length;
 const due=lim===0?allDue:allDue.slice(0,Math.max(0,lim-doneDue));
 const fresh=active.filter(c=>!P(c)?.due).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)).slice(0,Math.max(0,s.settings.newPerDay-introduced));
 // Intercala matérias para não revisar uma só de cada vez
 const mix=list=>{const by=new Map();for(const c of list){if(!by.has(c.subject))by.set(c.subject,[]);by.get(c.subject).push(c);}const out=[],qs=[...by.values()];while(qs.some(q=>q.length))for(const q of qs)if(q.length)out.push(q.shift());return out;};
 const ready=learning.filter(c=>Date.parse(P(c).due)<=time),waiting=learning.filter(c=>Date.parse(P(c).due)>time);
 return [...ready,...mix([...due,...fresh]),...waiting];
}
function review(s,id,grade,now=new Date()){
 if(!GRADES.includes(grade)||!s.cards.some(c=>c.id===id))throw Error('Revisão inválida');
 const n=clone(s),p=migrateProgress(n.progress[id]||{});
 if(p.suspended)throw Error('Cartão suspenso.');
 const first=!p.due,relearn=isLearning(p);
 const next=nextState(p,grade,now);
 n.progress[id]=next;
 const entry={cardId:id,at:next.lastReview,grade,first,interval:next.interval};
 if(relearn)entry.relearn=true;
 n.history.push(entry);return n;
}
// Desfaz a última revisão: marca o registro (para a sincronização respeitar) e restaura o agendamento anterior
function undo(s,before,now=new Date()){
 const last=[...s.history].reverse().find(h=>!h.undone);if(!last)throw Error('Nada para desfazer.');
 const n=clone(s),h=n.history.find(x=>x.cardId===last.cardId&&x.at===last.at&&x.grade===last.grade&&!x.undone);h.undone=true;
 const prev=before&&before.progress?before.progress[last.cardId]:undefined;
 if(prev)n.progress[last.cardId]={...clone(prev),changedAt:new Date(now).toISOString()};
 else n.progress[last.cardId]={changedAt:new Date(now).toISOString()};
 return {state:n,cardId:last.cardId};
}

// ---------- estatísticas para o painel ----------
function stats(s,now=new Date()){
 const t=+new Date(now),since=t-30*DAY,h=live(s).filter(x=>Date.parse(x.at)>=since&&!x.first&&!x.relearn);
 const byId=new Map(s.cards.map(c=>[c.id,c]));
 const agg=key=>{const m=new Map();for(const x of h){const c=byId.get(x.cardId);if(!c)continue;const k=key(c);if(!m.has(k))m.set(k,{ok:0,n:0});const a=m.get(k);a.n++;if(x.grade>0)a.ok++;}return [...m.entries()].map(([k,v])=>({key:k,...v,rate:v.n?v.ok/v.n:0})).sort((a,b)=>a.rate-b.rate);};
 const forecast=[];for(let i=0;i<7;i++){const d=new Date(t);d.setDate(d.getDate()+i);forecast.push({day:day(d),n:0});}
 const end=day(forecast[6].day+'T12:00');
 for(const c of s.cards){const p=s.progress[c.id];if(!p?.due||p.suspended)continue;let k=day(p.due);if(k<forecast[0].day)k=forecast[0].day;const f=forecast.find(x=>x.day===k);if(f&&k<=end)f.n++;}
 const leeches=s.cards.filter(c=>(s.progress[c.id]?.lapses||0)>=LEECH&&!s.progress[c.id]?.suspended).sort((a,b)=>s.progress[b.id].lapses-s.progress[a.id].lapses);
 const total=s.cards.length,fresh=s.cards.filter(c=>!s.progress[c.id]?.due).length,suspended=s.cards.filter(c=>s.progress[c.id]?.suspended).length;
 const mem=s.cards.filter(c=>Number.isFinite(s.progress[c.id]?.s)&&!s.progress[c.id].suspended).map(c=>{const p=s.progress[c.id];return retr(Math.max(0,(t-Date.parse(p.lastReview||t))/DAY),p.s);});
 return {reviews:h.length,ok:h.filter(x=>x.grade>0).length,bySubject:agg(c=>c.subject),byPattern:agg(c=>patternOf(c)),forecast,leeches,total,fresh,suspended,memory:mem.length?mem.reduce((a,b)=>a+b,0)/mem.length:null};
}
const retrievability=(p,now=new Date())=>Number.isFinite(p?.s)?retr(Math.max(0,(+new Date(now)-Date.parse(p.lastReview||now))/DAY),p.s):0;

const api={empty,validateBatch,importBatch,queue,review,undo,validateBackup,migrate,preview,intervalLabel,day,dueLimit,streak,stats,live,
 guessPattern,patternOf,PATTERNS,corrParts,retrievability,isLearning,tecIds,DUE_DEFAULT,LEECH};
if(typeof module!=='undefined')module.exports=api;else root.Revisao=api;
})(globalThis);
