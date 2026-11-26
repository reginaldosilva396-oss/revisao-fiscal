'use strict';
// Modos de treino: por padrão de erro, pré-teste de aula e contraste A × B.
// As notas dadas aqui contam como revisões normais (o FSRS lida com revisões antecipadas).
(function(){
 const R=Revisao,A=App,$=id=>document.getElementById(id),el=A.el,PAT=R.PATTERNS;
 const MAX={pattern:30,contrast:30,pretest:60};
 let mode='day';
 const active=()=>A.state.cards.filter(c=>!A.state.progress[c.id]?.suspended);
 // Ordem de treino: vencidos primeiro, depois os de memória mais fraca, depois os novos
 function order(list){
  const s=A.state,now=Date.now();
  const due=list.filter(c=>s.progress[c.id]?.due&&Date.parse(s.progress[c.id].due)<=now).sort((a,b)=>Date.parse(s.progress[a.id].due)-Date.parse(s.progress[b.id].due));
  const seen=list.filter(c=>s.progress[c.id]?.due&&Date.parse(s.progress[c.id].due)>now).sort((a,b)=>R.retrievability(s.progress[a.id])-R.retrievability(s.progress[b.id]));
  const fresh=list.filter(c=>!s.progress[c.id]?.due);
  return [...due,...seen,...fresh];
 }
 const lessonLabel=l=>{const m=l.match(/^([A-Z]+)-AULA-(\d+)$/);return m?m[1]+' · Aula '+m[2]:l;};
 function groups(){
  const c=active();
  if(mode==='pattern'){
   return Object.entries(PAT).map(([k,v])=>({value:k,label:'P'+k+' · '+v,cards:c.filter(x=>String(R.patternOf(x))===k)}));
  }
  if(mode==='contrast'){
   const pool=c.filter(x=>x.type==='par'||R.patternOf(x)===1);
   const subs=[...new Set(pool.map(x=>x.subject))].sort();
   return [{value:'',label:'Todas as matérias',cards:pool},...subs.map(x=>({value:x,label:x,cards:pool.filter(y=>y.subject===x)}))];
  }
  if(mode==='pretest'){
   const out=[],les=new Map(),top=new Map();
   for(const x of c){for(const l of x.lessons||[]){if(!les.has(l))les.set(l,[]);les.get(l).push(x);}const k=x.subject+' · '+x.topic;if(!top.has(k))top.set(k,[]);top.get(k).push(x);}
   for(const [l,v]of [...les.entries()].sort())out.push({value:'L:'+l,label:lessonLabel(l),cards:v,group:'Por aula'});
   for(const [k,v]of [...top.entries()].sort())out.push({value:'T:'+k,label:k,cards:v,group:'Por assunto'});
   return out;
  }
  return [];
 }
 const TEXT={
  pattern:['Padrão','Até 30 cartões do padrão escolhido: primeiro os vencidos, depois os de memória mais fraca. Padrões sem marcação no cartão são sugeridos pelo app; corrija na edição do cartão se estiver errado.'],
  contrast:['Matéria','Cartões de pares que você confunde (P1) e tabelas A × B, até 30 por vez.'],
  pretest:['Aula ou assunto','Use antes de um Teste do Guruja: todos os cartões daquela aula ou assunto, com placar por padrão e a lista do que você errou no fim.'],
 };
 function setMode(m){
  mode=m;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));
  if(A.session)stop(false);
  $('day-filters').hidden=m!=='day';$('setup').hidden=m==='day';$('summary').hidden=true;
  document.querySelector('.flashcard').hidden=m!=='day';window.Foco?.visible(m==='day');
  if(m==='day'){A.render();return;}
  const [label,text]=TEXT[m];$('setup-label').textContent=label;$('setup-text').textContent=text;
  const sel=$('setup-select');sel.replaceChildren();let og=null,grp=null;
  for(const g of groups()){
   if(g.group&&g.group!==grp){grp=g.group;og=el('optgroup',{label:grp});sel.append(og);}
   const o=new Option(g.label+' ('+g.cards.length+')',g.value);o.disabled=!g.cards.length;(og||sel).append(o);
  }
  const first=[...sel.options].find(o=>!o.disabled);if(first)sel.value=first.value;
  $('setup-start').disabled=!first;
 }
 function start(title,ids,kind){
  if(!ids.length)return A.notify('Não há cartões para esse treino.');
  A.setSession({kind,title,ids,pos:0,results:{},firstTry:{},seen:{}});
  $('setup').hidden=true;$('summary').hidden=true;$('session-bar').hidden=false;
  document.querySelector('.flashcard').hidden=false;window.Foco?.visible(false);
  render();
 }
 $('setup-start').onclick=()=>{
  const g=groups().find(x=>x.value===$('setup-select').value);if(!g)return;
  const list=mode==='pretest'?g.cards:order(g.cards);
  start((mode==='pattern'?'Treino ':mode==='pretest'?'Pré-teste ':'Contraste ')+'· '+g.label,list.slice(0,MAX[mode]).map(c=>c.id),mode);
 };
 function render(){
  const se=A.session;if(!se)return;
  const total=se.ids.length,done=Math.min(se.pos,total);
  $('session-title').textContent=se.title;$('session-count').textContent=done+' de '+total;
  $('session-fill').style.width=(total?done/total*100:0)+'%';
  if(se.pos>=total)return summary();
  const c=A.state.cards.find(x=>x.id===se.ids[se.pos]);
  if(!c){se.pos++;return render();}
  if(A.current?.id!==c.id)A.showCard(c);
 }
 function record(id,g,ceOk){
  const se=A.session;if(!se)return;
  if(!(id in se.firstTry))se.firstTry[id]=g>0&&ceOk!==false;
  se.results[id]=g;se.pos++;
  se.seen[id]=(se.seen[id]||0)+1;
  if(g===0&&se.seen[id]<3)se.ids.push(id); // volta no fim do treino
 }
 function summary(){
  const se=A.session,s=A.state;const ids=Object.keys(se.firstTry);
  document.querySelector('.flashcard').hidden=true;$('session-bar').hidden=true;
  const ok=ids.filter(id=>se.firstTry[id]).length,wrong=ids.filter(id=>!se.firstTry[id]);
  const byP=new Map();for(const id of ids){const c=s.cards.find(x=>x.id===id);if(!c)continue;const p=R.patternOf(c);if(!byP.has(p))byP.set(p,{ok:0,n:0});const a=byP.get(p);a.n++;if(se.firstTry[id])a.ok++;}
  const box=$('summary');box.hidden=false;
  const rows=[...byP.entries()].sort((a,b)=>a[0]-b[0]).map(([p,v])=>el('tr',{},el('td',{text:p?'P'+p+' · '+PAT[p]:'Sem padrão'}),el('td',{text:v.ok+'/'+v.n}),el('td',{text:Math.round(v.ok/v.n*100)+'%'})));
  const list=el('ol');for(const id of wrong){const c=s.cards.find(x=>x.id===id);if(c)list.append(el('li',{},el('b',{text:c.subject+': '}),c.front));}
  box.replaceChildren(
   el('p',{class:'eyebrow',text:'RESULTADO'}),el('h2',{text:se.title}),
   el('p',{class:'score',text:ok+' de '+ids.length+' certos de primeira ('+(ids.length?Math.round(ok/ids.length*100):0)+'%)'}),
   rows.length?el('table',{class:'pair'},el('tr',{},el('th',{text:'Padrão'}),el('th',{text:'Acertos'}),el('th',{text:'%'})),...rows):null,
   wrong.length?el('h3',{text:'O que você errou'}):el('p',{text:'Nenhum erro de primeira. Bom sinal para o Teste.'}),wrong.length?list:null,
   el('div',{class:'focus-actions'},
    wrong.length?el('button',{class:'primary',text:'Treinar só os errados',onclick:()=>start('Errados · '+se.title,wrong,se.kind)}):null,
    el('button',{text:'Voltar',onclick:()=>setMode(mode)}),
    el('button',{text:'Revisão do dia',onclick:()=>setMode('day')}))
  );
  A.setSession(null);
 }
 function stop(show=true){A.setSession(null);$('session-bar').hidden=true;if(show)setMode(mode);}
 $('session-stop').onclick=()=>{const se=A.session;if(se&&Object.keys(se.firstTry).length){se.ids=se.ids.slice(0,se.pos);summary();}else stop();};
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
 window.Modes={render,record,order,restore(sess){A.setSession(sess);$('summary').hidden=true;$('session-bar').hidden=false;document.querySelector('.flashcard').hidden=false;},start:(title,ids,kind='pattern')=>{document.querySelector('[data-tab="review"]').click();mode=kind;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===kind));$('day-filters').hidden=true;start(title,ids,kind);},setMode};
})();
