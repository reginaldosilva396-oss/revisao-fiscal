'use strict';
(()=>{
const items=[
['meta-32-dadm-revisao-aula-08-pagina-1','Direito Administrativo','Contratação direta · Pág. 1/2 — O mapa'],
['meta-32-dadm-revisao-aula-08-pagina-2','Direito Administrativo','Contratação direta · Pág. 2/2 — Inexigível × dispensável'],
['meta-32-dadm-revisao-aulas-04-05-pagina-1','Direito Administrativo','Poderes e terceiro setor · Pág. 1/3 — Poderes e deveres'],
['meta-32-dadm-revisao-aulas-04-05-pagina-2','Direito Administrativo','Poderes e terceiro setor · Pág. 2/3 — Poder de polícia e abuso'],
['meta-32-dadm-revisao-aulas-04-05-pagina-3','Direito Administrativo','Poderes e terceiro setor · Pág. 3/3 — Terceiro setor'],
['meta-32-ti-nosql-pagina-1','Tecnologia da Informação','NoSQL — conceitos e siglas · Pág. 1/2'],
['meta-32-ti-nosql-pagina-2','Tecnologia da Informação','NoSQL — os quatro tipos · Pág. 2/2'],
['meta-32-dcon-revisao-aulas-14-15-pagina-1','Direito Constitucional','Judiciário e Funções Essenciais à Justiça · Pág. 1/5 — Judiciário: regras gerais'],
['meta-32-dcon-revisao-aulas-14-15-pagina-2','Direito Constitucional','Judiciário e Funções Essenciais à Justiça · Pág. 2/5 — Quem julga o quê?'],
['meta-32-dcon-revisao-aulas-14-15-pagina-3','Direito Constitucional','Judiciário e Funções Essenciais à Justiça · Pág. 3/5 — STF, SV, CNJ e competências'],
['meta-32-dcon-revisao-aulas-14-15-pagina-4','Direito Constitucional','Judiciário e Funções Essenciais à Justiça · Pág. 4/5 — Ministério Público'],
['meta-32-dcon-revisao-aulas-14-15-pagina-5','Direito Constitucional','Judiciário e Funções Essenciais à Justiça · Pág. 5/5 — Advocacia e Defensoria'],
['meta-31-dcon-funcoes-essenciais-a-justica','Direito Constitucional','Funções essenciais à Justiça'],
['meta-31-ctbga-aulas-00-04-conceitos-e-escrituracao','Contabilidade básica','Conceitos e escrituração'],
['meta-31-ctbga-imobilizado-intangivel-impairment','Contabilidade avançada','Imobilizado, intangível e recuperabilidade'],
['meta-31-dadm-licitacoes-lei-14133-parte-1','Direito Administrativo','Licitações: princípios e julgamento'],
['meta-31-dcon-direitos-dos-domesticos','Direito Constitucional','Direitos dos trabalhadores domésticos'],
['meta-31-estat-separatrizes-box-plot','Estatística','Mediana, quantis e box plot'],
['meta-31-macro-modelo-classico','Economia','Modelo clássico'],
['meta-31-micro-conceitos-oferta-demanda','Economia','Escassez, oferta e demanda'],
['meta-31-rlog-argumentacao-logica','Raciocínio Lógico','Argumentação e validade']
];
const cacheName='revisao-fiscal-infographics-v1';
const grid=document.getElementById('infographic-grid');

const groups=new Map();
for(const [id,subject,title] of items){
 const key=id.replace(/-pagina-\d+$/,'');
 if(!groups.has(key))groups.set(key,[]);
 groups.get(key).push([id,subject,title]);
}

const reader=document.createElement('dialog');reader.className='info-reader';reader.setAttribute('aria-label','Infográfico completo');
const toolbar=document.createElement('div');toolbar.className='info-reader-toolbar';
const readerTitle=document.createElement('h2'),close=document.createElement('button');close.textContent='Fechar';
close.onclick=()=>reader.close();toolbar.append(readerTitle,close);
const readerPages=document.createElement('div');readerPages.className='info-reader-pages';
reader.append(toolbar,readerPages);document.body.append(reader);
function showInfographic(pages,title){
 readerTitle.textContent=title;readerPages.replaceChildren();
 for(const [id,,pageTitle]of pages){
  const img=document.createElement('img');img.src='./infograficos/'+id+'.png';img.alt=pageTitle;img.width=1024;img.height=1536;
  readerPages.append(img);
 }
 reader.showModal();reader.scrollTop=0;
}
for(const pages of groups.values()){
 pages.sort((a,b)=>a[0].localeCompare(b[0],'pt-BR',{numeric:true}));
 const [firstId,subject,firstTitle]=pages[0];
 const topic=firstId.includes('-ti-nosql-')?'NoSQL':firstTitle.split(' · Pág.')[0];
 const card=document.createElement('article');card.className='info-card';
 card.dataset.meta=firstId.split('-')[1];card.dataset.subject=subject;card.dataset.topic=topic;
 const preview=document.createElement('button');preview.className='info-cover';preview.setAttribute('aria-label','Abrir infográfico completo: '+topic);
 const img=document.createElement('img');img.src='./infograficos/'+firstId+'.png';img.alt=topic;img.loading='lazy';img.width=1024;img.height=1536;
 preview.append(img);preview.onclick=()=>showInfographic(pages,topic);
 const meta=document.createElement('p');meta.className='eyebrow';meta.textContent='Meta '+card.dataset.meta+' · '+subject;
 const heading=document.createElement('h3');heading.textContent=topic;
 const caption=document.createElement('p');caption.textContent=pages.length+' página'+(pages.length>1?'s':'');
 const open=document.createElement('button');open.className='primary';open.textContent='Abrir infográfico';open.onclick=()=>showInfographic(pages,topic);
 card.append(preview,meta,heading,caption,open);grid.append(card);
}
const metaFilter=document.getElementById('infographic-meta');
const subjectFilter=document.getElementById('infographic-subject');
const topicFilter=document.getElementById('infographic-topic');
function options(select,values,label){
 const previous=select.value;
 select.replaceChildren(new Option(label,''),...Array.from(new Set(values)).sort((a,b)=>a.localeCompare(b,'pt-BR')).map(x=>new Option(x,x)));
 select.value=values.includes(previous)?previous:'';
}
function filter(){
 const inMeta=Array.from(grid.children).filter(c=>!metaFilter.value||c.dataset.meta===metaFilter.value);
 options(subjectFilter,inMeta.map(c=>c.dataset.subject),'Todas as matérias');
 const inSubject=inMeta.filter(c=>!subjectFilter.value||c.dataset.subject===subjectFilter.value);
 options(topicFilter,inSubject.map(c=>c.dataset.topic),'Todos os assuntos');
 let count=0;
 for(const card of grid.children){
  card.hidden=!!((metaFilter.value&&card.dataset.meta!==metaFilter.value)||(subjectFilter.value&&card.dataset.subject!==subjectFilter.value)||(topicFilter.value&&card.dataset.topic!==topicFilter.value));
  if(!card.hidden)count++;
 }
 document.getElementById('infographic-count').textContent=count+' de '+groups.size+' infográficos';
}
metaFilter.onchange=filter;subjectFilter.onchange=filter;topicFilter.onchange=filter;filter();
const button=document.getElementById('save-infographics'),status=document.getElementById('infographic-status');
button.onclick=async()=>{
 button.disabled=true;
 try{
  if(!('caches'in window)||!('serviceWorker'in navigator))throw Error('Este navegador não oferece armazenamento offline. Use Baixar imagem.');
  const cache=await caches.open(cacheName);let done=0;
  for(const [id] of items){
   const url='./infograficos/'+id+'.png';status.textContent='Salvando '+(done+1)+' de '+items.length+'…';
   if(!await cache.match(url)){
    const res=await fetch(url,{credentials:'include'});
    if(!res.ok||!res.headers.get('content-type')?.startsWith('image/'))throw Error('Não foi possível baixar uma imagem. Verifique a conexão e tente novamente.');
    await cache.put(url,res);
   }
   done++;
  }
  status.textContent='As '+items.length+' imagens estão salvas neste navegador. O navegador pode liberar esse espaço; use Baixar imagem para guardar uma cópia na Galeria.';
 }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
};
if(location.hash==='#infograficos')document.querySelector('[data-tab="infographics"]').click();
})();



