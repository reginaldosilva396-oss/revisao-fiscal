'use strict';
// Sincronização entre aparelhos via GitHub Gist secreto. Funciona offline: sincroniza quando há internet.
(function(){
 const CFG='revisao-fiscal-sync',DESC='revisao-fiscal-sync (não apague: progresso do app Revisão Fiscal)',FILE='revisao-fiscal.json',API='https://api.github.com';
 const box=document.createElement('section');box.className='sync-box';
 box.innerHTML='<h3>Sincronizar celular e computador</h3><p id="sync-status" class="sync-status" role="status" aria-live="polite"></p>'+
  '<div id="sync-off"><p>Cole um token do GitHub com permissão <b>somente gist</b>. Faça isso uma vez em cada aparelho.</p><label>Token do GitHub <input id="sync-token" type="password" autocomplete="off" placeholder="ghp_..."></label><button id="sync-connect" class="primary">Conectar</button></div>'+
  '<div id="sync-on" hidden><button id="sync-now" class="primary">Sincronizar agora</button><button id="sync-disconnect">Desconectar este aparelho</button><p class="note">Seu progresso fica num gist secreto da sua conta. A sincronização é automática: ao abrir o app, depois das revisões e quando a internet volta. Para trocar de token, desconecte e conecte de novo.</p></div>';
 const data=document.getElementById('data');data.querySelector('h2').after(box);
 const $=id=>document.getElementById(id);
 let cfg=null,busy=false,again=false,timer=null;
 try{cfg=JSON.parse(localStorage.getItem(CFG)||'null');}catch{cfg=null;}
 const save=c=>{cfg=c;if(c)localStorage.setItem(CFG,JSON.stringify(c));else localStorage.removeItem(CFG);ui();};
 const status=t=>{$('sync-status').textContent=t;};
 function ui(){
  $('sync-off').hidden=!!cfg;$('sync-on').hidden=!cfg;
  if(!cfg)status('Não conectado: os dados ficam só neste aparelho.');
  else if(cfg.last)status('Sincronizado em '+new Date(cfg.last).toLocaleString('pt-BR')+(cfg.cards!==undefined?' · '+cfg.cards+' cartões, '+cfg.reviews+' revisões':'')+'.');
  else status('Conectado.');
 }
 async function gh(path,opt={}){
  const res=await fetch(API+path,{...opt,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+cfg.token,'X-GitHub-Api-Version':'2022-11-28',...(opt.body?{'Content-Type':'application/json'}:{})},cache:'no-store'});
  if(res.status===401)throw Object.assign(Error('Token inválido ou expirado. Desconecte e conecte com um token novo.'),{auth:true});
  if(res.status===403||res.status===404)throw Object.assign(Error('O token não tem permissão de gist, ou o gist foi apagado. Gere um token com a permissão gist.'),{auth:true});
  if(!res.ok)throw Error('GitHub respondeu '+res.status+'. Tente de novo mais tarde.');
  return res.status===204?null:res.json();
 }
 async function readRemote(id){
  const g=await gh('/gists/'+id);const f=g.files?.[FILE];
  if(!f)return null;
  const text=f.truncated?await (await fetch(f.raw_url,{cache:'no-store'})).text():f.content;
  return Revisao.validateBackup(JSON.parse(text));
 }
 const body=state=>JSON.stringify({files:{[FILE]:{content:JSON.stringify(state)}}});
 // Todos os gists de sincronização da conta, do mais antigo ao mais novo (dois aparelhos podem ter criado um cada).
 async function locate(){
  const found=[];
  for(let page=1;page<=10;page++){
   const list=await gh('/gists?per_page=100&page='+page);
   for(const g of list)if(g.description===DESC&&g.files?.[FILE])found.push(g);
   if(list.length<100)break;
  }
  return found.sort((a,b)=>Date.parse(a.created_at||0)-Date.parse(b.created_at||0)).map(g=>g.id);
 }
 async function sync(){
  if(!cfg||!s)return;
  if(!navigator.onLine){status('Offline: as revisões ficam guardadas aqui e sobem quando a internet voltar.');return;}
  if(busy){again=true;return;}
  busy=true;status('Sincronizando…');
  try{
   let ids=await locate();
   if(!ids.length){const g=await gh('/gists',{method:'POST',body:JSON.stringify({description:DESC,public:false,files:{[FILE]:{content:JSON.stringify(s)}}})});ids=[g.id];}
   const [main,...extras]=ids;
   let merged=s;
   for(const id of extras){try{const r=await readRemote(id);if(r)merged=SyncCore.merge(merged,r);}catch(e){if(!e.auth)throw e;}}
   const remote=await readRemote(main);
   merged=SyncCore.merge(merged,remote);
   merged=Revisao.validateBackup(merged);
   if(!SyncCore.same(merged,s)){localStorage.setItem(KEY,JSON.stringify(merged));s=merged;render();}
   if(!remote||!SyncCore.same(merged,remote))await gh('/gists/'+main,{method:'PATCH',body:body(merged)});
   for(const id of extras){try{await gh('/gists/'+id,{method:'DELETE'});}catch{}}
   save({...cfg,gistId:main,last:new Date().toISOString(),cards:s.cards.length,reviews:s.history.length});
  }catch(e){status('Não sincronizou: '+e.message);if(e.auth)console.warn(e);}
  finally{busy=false;if(again){again=false;sync();}}
 }
 const later=()=>{clearTimeout(timer);timer=setTimeout(sync,4000);};
 $('sync-connect').onclick=async()=>{
  const token=$('sync-token').value.trim();
  if(!/^(ghp_|github_pat_|gho_)[A-Za-z0-9_]{20,}$/.test(token))return status('Esse não parece um token do GitHub. Ele começa com ghp_ ou github_pat_.');
  save({token});$('sync-token').value='';
  try{await gh('/gists?per_page=1');}catch(e){save(null);return status('Não conectou: '+e.message);}
  await sync();
 };
 $('sync-now').onclick=sync;
 $('sync-disconnect').onclick=()=>{save(null);status('Desconectado. Os dados continuam neste aparelho; o gist continua na sua conta.');};
 window.Sync={changed:later,now:sync};
 window.addEventListener('online',sync);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'||timer){clearTimeout(timer);timer=null;sync();}});
 ui();sync();
})();
