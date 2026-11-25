(function(root){
'use strict';
// Junção de dois estados do Revisão Fiscal (local × nuvem), cartão por cartão.
// Função pura: não altera os argumentos. Ordem canônica = ordem da nuvem + itens só locais no fim.
const clone=x=>JSON.parse(JSON.stringify(x));
const t=x=>{const n=Date.parse(x||'');return Number.isFinite(n)?n:0;};
const stamp=p=>p?Math.max(t(p.changedAt),t(p.lastReview)):0;
function stable(x){
 if(Array.isArray(x))return '['+x.map(stable).join(',')+']';
 if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';
 return JSON.stringify(x);
}
function pickCard(a,b){
 if(a.revision!==b.revision)return a.revision>b.revision?a:b;
 return t(b.editedAt)>t(a.editedAt)?b:a;
}
function merge(local,remote){
 if(!remote)return clone(local);
 if(!local)return clone(remote);
 const out={schemaVersion:1};
 // Cartões
 const lc=new Map(local.cards.map(c=>[c.id,c])),seen=new Set(),cards=[];
 for(const r of remote.cards){const l=lc.get(r.id);cards.push(clone(l?pickCard(r,l):r));seen.add(r.id);}
 for(const l of local.cards)if(!seen.has(l.id))cards.push(clone(l));
 out.cards=cards;
 // Progresso: vale a alteração mais recente de cada cartão
 const progress={},ids=new Set([...Object.keys(remote.progress||{}),...Object.keys(local.progress||{})]);
 for(const id of ids){const r=remote.progress?.[id],l=local.progress?.[id];progress[id]=clone(!r?l:!l?r:stamp(l)>stamp(r)?l:r);}
 out.progress=progress;
 // Histórico: união sem duplicar
 const hk=h=>h.cardId+'|'+h.at+'|'+h.grade,hist=new Map();
 for(const h of [...remote.history,...local.history])if(!hist.has(hk(h)))hist.set(hk(h),clone(h));
 out.history=[...hist.values()].sort((a,b)=>t(a.at)-t(b.at)||a.cardId.localeCompare(b.cardId));
 // Configurações: a alteração mais recente
 out.settings=clone(t(local.settings?.changedAt)>t(remote.settings?.changedAt)?local.settings:remote.settings);
 // Importações: união sem duplicar
 const ik=i=>i.at+'|'+(i.batchId||''),imp=new Map();
 for(const i of [...(remote.imports||[]),...(local.imports||[])])if(!imp.has(ik(i)))imp.set(ik(i),clone(i));
 out.imports=[...imp.values()].sort((a,b)=>t(a.at)-t(b.at));
 return out;
}
const same=(a,b)=>stable(a)===stable(b);
const api={merge,same,stable};
if(typeof module!=='undefined')module.exports=api;else root.SyncCore=api;
})(globalThis);
