'use strict';
// Janela de status do jogador: nível, rank, XP, atributos e missão diária, calculados do histórico de revisões.
(function(){
 const R=Revisao,A=App,el=A.el,box=document.getElementById('status-window'),LV='revisao-fiscal-level';
 const RANKS=[[55,'S','Auditor Fiscal'],[35,'A','Auditor em formação'],[20,'B','Analista de pegadinhas'],[10,'C','Caçador de exceções'],[5,'D','Leitor de lei seca'],[1,'E','Candidato despertado']];
 // XP: 10 por revisão, +5 se lembrou, +5 por cartão novo. Revisões trazidas do Revisão de Bolso contam 10 cada.
 function xpOf(s){
  let xp=0;for(const h of R.live(s))xp+=10+(h.grade>0?5:0)+(h.first?5:0);
  for(const p of Object.values(s.progress))if(p&&p.from==='bolso')xp+=10*(p.reps||0);
  return xp;
 }
 const levelOf=xp=>Math.floor((1+Math.sqrt(1+0.08*xp))/2);
 const need=n=>50*n*(n-1);
 function quest(s){
  const today=R.day(new Date()),h=R.live(s).filter(x=>R.day(x.at)===today);
  const q=R.queue(s),P=c=>s.progress[c.id];
  const dueLeft=q.filter(c=>P(c)?.due&&!R.isLearning(P(c))).length,newLeft=q.filter(c=>!P(c)?.due).length,again=q.filter(c=>R.isLearning(P(c))).length;
  const dueDone=h.filter(x=>!x.first&&!x.relearn).length,newDone=h.filter(x=>x.first).length;
  const items=[['Revisar os cartões vencidos',dueDone,dueDone+dueLeft],['Aprender cartões novos',newDone,newDone+newLeft]];
  if(h.some(x=>x.grade===0)||again)items.push(['Refazer os que você errou hoje',again?0:1,1,again?again+' pendente(s)':'ok']);
  return items;
 }
 function update(){
  const s=A.state;if(!s||!box)return;
  const xp=xpOf(s),lvl=levelOf(xp),[,rank,title]=RANKS.find(r=>lvl>=r[0]);
  const cur=xp-need(lvl),span=need(lvl+1)-need(lvl);
  const st=R.stats(s),streak=R.streak(s);
  const mastered=s.cards.filter(c=>(s.progress[c.id]?.s||0)>=21).length;
  const items=quest(s),complete=items.every(([, d,t])=>d>=t);
  box.replaceChildren(
   el('div',{class:'status-title'},el('b',{text:'STATUS'}),el('span',{text:new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit'})})),
   el('div',{class:'lvl'},el('div',{},el('small',{text:'NÍVEL'}),el('b',{text:String(lvl)})),el('span',{class:'rank',text:'RANK '+rank})),
   el('p',{class:'status-name'},'Jogador',el('em',{text:title})),
   el('div',{class:'xp'},el('i',{style:'width:'+Math.min(100,Math.round(cur/span*100))+'%'})),
   el('div',{class:'xp-label'},el('span',{text:'XP '+cur+' / '+span}),el('span',{text:(span-cur)+' para o nível '+(lvl+1)})),
   el('div',{class:'attrs'},
    ...[['Memória',st.memory==null?'—':Math.round(st.memory*100)+'%'],['Precisão 30d',st.reviews?Math.round(st.ok/st.reviews*100)+'%':'—'],['Sequência',streak+(streak===1?' dia':' dias')],['Dominados',mastered+' / '+s.cards.length]].map(([k,v])=>el('div',{},el('small',{text:k}),el('b',{text:v})))),
   el('div',{class:'quest'},el('h3',{text:complete?'Missão diária · cumprida':'Missão diária'}),
    el('ul',{},...items.map(([name,d,t,extra])=>el('li',{class:d>=t?'done':''},el('span',{text:name}),el('b',{text:extra||(Math.min(d,t)+' / '+t)})))),
    el('p',{text:complete?'Recompensa recebida. Volte amanhã para manter a sequência.':'Sem penalidade: o que sobrar vai para amanhã, dentro do limite diário.'}))
  );
  let prev=0;try{prev=Number(localStorage.getItem(LV))||0;}catch{}
  if(prev&&lvl>prev&&lvl-prev<=2)levelUp(lvl,RANKS.find(r=>lvl>=r[0]),RANKS.find(r=>prev>=r[0]));
  try{localStorage.setItem(LV,String(lvl));}catch{}
 }
 function levelUp(lvl,[,rank,title],[,oldRank]){
  const o=el('div',{class:'levelup',role:'alert'},el('div',{},el('small',{text:'[SISTEMA]'}),el('b',{text:'LEVEL UP!'}),el('span',{text:'Nível '+lvl+(rank!==oldRank?' · novo rank '+rank+' · '+title:'')})));
  o.onclick=()=>o.remove();document.body.append(o);setTimeout(()=>o.remove(),2600);
 }
 window.Player={update};update();
})();
