'use strict';
// Modo foco: sessões curtas de 5 cartões, sequência de dias e limite diário de vencidos.
(function(){
 const SIZE=5,card=document.querySelector('.flashcard');
 const bar=document.createElement('div');bar.className='focus-bar';
 bar.innerHTML='<p id="focus-line" class="focus-line"></p><button id="focus-start" class="primary">Começar com 5 cartões</button><div id="focus-progress" class="focus-progress" hidden><span id="focus-count"></span><div class="focus-track"><i id="focus-fill"></i></div></div>';
 const done=document.createElement('div');done.className='focus-done';done.hidden=true;
 done.innerHTML='<p class="eyebrow">SESSÃO CONCLUÍDA</p><h2 id="focus-done-title"></h2><p id="focus-done-text"></p><div class="focus-actions"><button id="focus-more" class="primary">Mais 5 cartões</button><button id="focus-stop">Parar por hoje</button></div>';
 card.before(bar);card.after(done);
 const $=id=>document.getElementById(id);
 let session=null,lastQueue=[];
 const reviewsToday=()=>s?s.history.filter(h=>Revisao.day(h.at)===Revisao.day(new Date())).length:0;
 function totalDue(){if(!s)return 0;const now=Date.now();return s.cards.filter(c=>s.progress[c.id]?.due&&!s.progress[c.id]?.suspended&&Date.parse(s.progress[c.id].due)<=now).length;}
 function line(){
  if(!s)return '';
  const st=Revisao.streak(s),hoje=reviewsToday(),parts=[];
  parts.push(st?`${st} ${st===1?'dia seguido':'dias seguidos'} revisando`:'Comece sua sequência hoje');
  if(hoje)parts.push(`${hoje} ${hoje===1?'revisão':'revisões'} hoje`);
  const lim=Revisao.dueLimit(s),todayDue=Revisao.queue(s).filter(c=>s.progress[c.id]?.due).length,rest=totalDue()-todayDue;
  if(lim&&rest>0)parts.push(`${rest} vencidos ficam para os próximos dias (limite de ${lim}/dia), sem acumular culpa`);
  return parts.join(' · ');
 }
 function finish(){
  const n=session.done;session=null;card.hidden=true;done.hidden=false;bar.hidden=true;
  $('focus-done-title').textContent=`${n} ${n===1?'cartão revisado':'cartões revisados'}. Feito.`;
  const st=s?Revisao.streak(s):0,left=lastQueue.length;
  $('focus-done-text').textContent=(st>1?`Sequência de ${st} dias mantida. `:'Sequência iniciada. ')+(left?`Ainda há ${left} na fila de hoje: continue só se quiser.`:'A fila de hoje terminou.');
  $('focus-more').hidden=!left;
 }
 function update(q){
  lastQueue=q||[];$('focus-line').textContent=line();
  if(session){
   const n=s.history.length-session.base;session.done=n;
   $('focus-count').textContent=`Sessão: ${Math.min(n,SIZE)} de ${SIZE}`;$('focus-fill').style.width=Math.min(100,n/SIZE*100)+'%';
   if(n>=SIZE||!lastQueue.length)finish();
  }
  $('focus-start').hidden=!!session||!lastQueue.length;$('focus-progress').hidden=!session;
 }
 function start(){if(!s||!lastQueue.length)return;session={base:s.history.length,done:0};card.hidden=false;done.hidden=true;bar.hidden=false;update(lastQueue);card.scrollIntoView({behavior:'smooth',block:'start'});}
 $('focus-start').onclick=start;$('focus-more').onclick=start;
 $('focus-stop').onclick=()=>{done.hidden=true;card.hidden=false;bar.hidden=false;notify('Bom trabalho. Você pode retomar quando quiser.');update(lastQueue);};
 // Configuração do limite diário de vencidos
 const cfg=document.createElement('div');
 cfg.innerHTML='<label>Máximo de vencidos por dia <input id="maxDue" type="number" min="0" max="500"></label><button id="saveMaxDue">Salvar máximo</button><p class="note">Depois de dias parado, a fila não vira uma montanha: os vencidos mais antigos vêm primeiro e o restante fica para os dias seguintes. Use 0 para não limitar. Padrão: '+Revisao.DUE_DEFAULT+'.</p>';
 $('saveSettings').after(cfg);
 const fill=()=>{if(s)$('maxDue').value=Revisao.dueLimit(s);};
 $('saveMaxDue').onclick=()=>{const n=Number($('maxDue').value);if(!Number.isInteger(n)||n<0||n>500)return notify('Escolha um número inteiro de 0 a 500.');if(s){const next=structuredClone(s);next.settings.maxDuePerDay=n;if(persist(next))notify('Máximo diário de vencidos salvo.');}};
 window.Foco={update:q=>{update(q);fill();}};
 render();
})();

