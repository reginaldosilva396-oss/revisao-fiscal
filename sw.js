const CACHE='revisao-fiscal-mobile-v20';
const IMAGE_CACHE='revisao-fiscal-infographics-v2';
const ASSETS=['./','./index.html','./style.css?v=13','./infographics.css?v=10','./core.js?v=13','./app.js?v=13','./focus.js?v=13','./sync-core.js?v=13','./sync.js?v=14','./mobile.js?v=2','./infographics.js?v=18','./modes.js?v=1','./dash.js?v=1','./lotes/revisao-de-bolso.json','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(url=>new Request(url,{credentials:'include',cache:'reload'})))).then(()=>self.skipWaiting())));
// Apaga versões antigas do app e o cache de imagens PNG (substituídas por WebP)
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('revisao-fiscal-mobile-')&&k!==CACHE)||(k.startsWith('revisao-fiscal-infographics-')&&k!==IMAGE_CACHE)).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==location.origin)return;
 if(u.pathname.startsWith(new URL('./infograficos/',self.registration.scope).pathname)&&/\.(webp|png)$/.test(u.pathname)){
  e.respondWith(caches.open(IMAGE_CACHE).then(async c=>{
   const hit=await c.match(e.request);if(hit)return hit;
   const response=await fetch(e.request);
   if(response.ok&&response.headers.get('content-type')?.startsWith('image/')){try{await c.put(e.request,response.clone());}catch{}}
   return response;
  }));return;
 }
 if(!ASSETS.some(a=>new URL(a,self.registration.scope).pathname===u.pathname))return;
 if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('./index.html')));return;}
 e.respondWith(caches.match(e.request,{ignoreSearch:u.pathname.endsWith('.json')}).then(c=>c||fetch(e.request)));
});
