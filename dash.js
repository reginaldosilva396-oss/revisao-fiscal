'use strict';
// Painel: acerto dos últimos 30 dias por matéria e padrão, vencimentos da semana e cartões que você mais erra.
(function(){
 const R=Revisao,A=App,el=A.el,PAT=R.PATTERNS,$=id=>document.getElementById(id);
 const pct=x=>Math.round(x*100)+'%';
 function bar(rate,n){
  const cls=rate>=0.85?'good':rate>=0.7?'mid':'low';
  return el('div',{class:'meter'},el('i',{class:cls,style:'width:'+Math.max(3,Math.round(rate*100))+'%'}),el('span',{text:pct(rate)+' · '+n+' revisões'}));
 }
 function table(rows,label,action){
  if(!rows.length)return el('p',{class:'note',text:'Ainda sem revisões nos últimos 30 dias.'});
  return el('div',{class:'dash-rows'},...rows.map(r=>el('div',{class:'dash-row'},el('b',{text:label(r.key)}),bar(r.rate,r.n),action?action(r):null)));
 }
 function refresh(){
  const s=A.state,body=$('dash-body');if(!s||!body||$('dash').hidden)return;
  const st=R.stats(s);
  const tiles=el('div',{class:'stats'},
   el('div',{class:'stat'},el('b',{text:st.reviews?pct(st.ok/st.reviews):'—'}),el('span',{text:'Acerto nas revisões (30 dias)'})),
   el('div',{class:'stat'},el('b',{text:st.memory==null?'—':pct(st.memory)}),el('span',{text:'Memória média estimada hoje'})),
   el('div',{class:'stat'},el('b',{text:String(st.total)}),el('span',{text:st.fresh+' novos · '+st.suspended+' suspensos'})));
  const maxF=Math.max(1,...st.forecast.map(f=>f.n));
  const week=el('div',{class:'forecast'},...st.forecast.map((f,i)=>el('div',{class:'fday'},el('i',{style:'height:'+Math.round(f.n/maxF*100)+'%'}),el('b',{text:String(f.n)}),el('span',{text:i===0?'hoje':new Date(f.day+'T12:00').toLocaleDateString('pt-BR',{weekday:'short'})}))));
  const lim=R.dueLimit(s);
  const pattern=table(st.byPattern,k=>k?'P'+k+' · '+PAT[k]:'Sem padrão',r=>r.key?el('button',{text:'Treinar',onclick:()=>{const ids=Modes.order(s.cards.filter(c=>R.patternOf(c)===r.key&&!s.progress[c.id]?.suspended)).slice(0,30).map(c=>c.id);Modes.start('Treino · P'+r.key+' · '+PAT[r.key],ids,'pattern');}}):null);
  const lee=st.leeches;
  const leeBox=lee.length?el('div',{},
   el('p',{text:'Repetir esses cartões não está resolvendo. Reescreva a pergunta, transforme em tabela A × B ou peça um infográfico do assunto.'}),
   el('div',{class:'focus-actions'},el('button',{class:'primary',text:'Treinar estes '+Math.min(30,lee.length),onclick:()=>Modes.start('Cartões que você mais erra',lee.slice(0,30).map(c=>c.id),'pattern')})),
   el('ul',{class:'leeches'},...lee.slice(0,20).map(c=>el('li',{},el('small',{text:c.subject+' · '+s.progress[c.id].lapses+' erros · '+(A.patternLabel(c)||'sem padrão')}),el('p',{text:c.front}),el('button',{class:'link-btn',text:'Corrigir',onclick:()=>A.openEditor(c)})))))
   :el('p',{class:'note',text:'Nenhum cartão com '+R.LEECH+' erros ou mais.'});
  body.replaceChildren(tiles,
   el('h3',{text:'Vencimentos dos próximos 7 dias'}),week,el('p',{class:'note',text:'Hoje inclui os atrasados. A fila do dia mostra no máximo '+(lim||'todos os')+' vencidos'+(lim?' por dia; o resto fica para os dias seguintes.':'.')}),
   el('h3',{text:'Acerto por padrão de erro'}),pattern,el('p',{class:'note',text:'Cartões sem padrão marcado usam a sugestão automática do app.'}),
   el('h3',{text:'Acerto por matéria'}),table(st.bySubject,k=>k),
   el('h3',{text:'Cartões que você mais erra'}),leeBox);
 }
 window.Dash={refresh};
})();
