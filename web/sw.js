const CACHE_NAME='body-motion-lab-digestion-v1';

const CORE_ASSETS=[
  './digestion.html', './digestion.css', './digestion.js', './digestion-data.js', './digestion-3d.js',
  './models/digestive/esophagus.glb',
  './models/digestive/stomach.glb',
  './models/digestive/small.glb',
  './models/digestive/large.glb',
  './models/digestive/liver.glb',
  './models/digestive/pancreas.glb',
  './models/digestive/gallbladder.glb',

  './',
  './index.html',
  './arm.html',
  './schematic.html',
  './anatomy.css',
  './body.css',
  './style.css',
  './body.js',
  './body-data.js',
  './atlas-data.js',
  './anatomy.js',
  './app.js',
  './vendor/three.module.js',
  './vendor/GLTFLoader.js',
  './vendor/DRACOLoader.js',
  './vendor/OrbitControls.js',
  './vendor/draco_decoder.js',
  './vendor/draco_decoder.wasm',
  './vendor/draco_wasm_wrapper.js',
  './vendor/vision_bundle.mjs',
  './vendor/vision_wasm_internal.js',
  './vendor/vision_wasm_internal.wasm',
  './vendor/pose.task',
  './models/body/skull.glb',
  './models/body/spine.glb',
  './models/body/ribs.glb',
  './models/body/sternum.glb',
  './models/body/costal.glb',
  './models/body/pelvis.glb',
  './models/body/sacrum.glb',
  './models/body/scapula.glb',
  './models/body/clavicle.glb',
  './models/body/humerus.glb',
  './models/body/radius.glb',
  './models/body/ulna.glb',
  './models/body/hand.glb',
  './models/body/pectoralis.glb',
  './models/body/rectus_abdominis.glb',
  './models/body/external_oblique.glb',
  './models/body/latissimus.glb',
  './models/body/trapezius.glb',
  './models/body/serratus.glb',
  './models/body/neck.glb',
  './models/body/face.glb',
  './models/body/deltoid.glb',
  './models/body/biceps_brachii.glb',
  './models/body/triceps_brachii.glb',
  './models/body/brachialis.glb',
  './models/body/brachioradialis.glb',
  './models/body/flexor_carpi_radialis.glb',
  './models/body/femur.glb',
  './models/body/patella.glb',
  './models/body/tibia.glb',
  './models/body/fibula.glb',
  './models/body/foot.glb',
  './models/body/gluteus.glb',
  './models/body/quads.glb',
  './models/body/hamstrings.glb',
  './models/body/sartorius.glb',
  './models/body/calf.glb',
  './models/body/shin.glb',
  './models/body/brain.glb',
  './models/body/heart.glb',
  './models/body/lungs.glb'
];

async function notifyClients(msg){
  const list=await self.clients.matchAll({includeUncontrolled:true});
  for(const c of list)c.postMessage(msg);
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    let done=0;
    const total=CORE_ASSETS.length;
    for(const url of CORE_ASSETS){
      try{
        const res=await fetch(url,{cache:'no-cache'});
        if(res.ok)await cache.put(url,res);
      }catch{}
      done++;
      if(done%6===0||done===total)notifyClients({type:'SW_CACHE_PROGRESS',done,total});
    }
    notifyClients({type:'SW_CACHE_DONE'});
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys()){
      if(key!==CACHE_NAME)await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  const isAsset=url.pathname.includes('/models/')||url.pathname.includes('/vendor/');
  if(isAsset){
    event.respondWith((async()=>{
      const cached=await caches.match(event.request,{ignoreSearch:true});
      if(cached)return cached;
      const res=await fetch(event.request);
      if(res.ok){
        const cache=await caches.open(CACHE_NAME);
        cache.put(event.request,res.clone());
      }
      return res;
    })());
  }else{
    event.respondWith((async()=>{
      try{
        const res=await fetch(event.request);
        if(res.ok){
          const cache=await caches.open(CACHE_NAME);
          cache.put(event.request,res.clone());
        }
        return res;
      }catch{
        const cached=await caches.match(event.request,{ignoreSearch:true});
        return cached||caches.match('./index.html');
      }
    })());
  }
});
