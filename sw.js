const CACHE='revisao-fiscal-mobile-v16';
const IMAGE_CACHE='revisao-fiscal-infographics-v1';
const ASSETS=['./','./index.html','./style.css?v=12','./core.js?v=12','./app.js?v=12','./focus.js?v=12','./sync-core.js?v=12','./sync.js?v=13','./manifest.webmanifest','./icon.svg','./mobile.js','./icon-192.png','./icon-512.png','./infographics.js?v=14','./infographics.css?v=9'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(url=>new Request(url,{credentials:'include',cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('revisao-fiscal-mobile-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==location.origin)return;
 if(u.pathname.startsWith(new URL('./infograficos/',self.registration.scope).pathname)&&u.pathname.endsWith('.png')){
  e.respondWith(caches.open(IMAGE_CACHE).then(async c=>{
   const hit=await c.match(e.request);if(hit)return hit;
   const response=await fetch(e.request);
   if(response.ok&&response.headers.get('content-type')?.startsWith('image/')){try{await c.put(e.request,response.clone());}catch{}}
   return response;
  }));return;
 }
 if(!ASSETS.some(a=>new URL(a,self.registration.scope).pathname===u.pathname))return;
 if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('./index.html')));return;}
 e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)));
});



