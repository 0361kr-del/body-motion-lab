import {teachingMuscleVertex,teachingMorphWeights} from './muscle-emphasis.js';
import * as T from 'three';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {DRACOLoader} from './vendor/DRACOLoader.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {PARTS,TEXTBOOK_GROUPS,BONE_FUNCTIONS,ORGANS,REGIONS,ZONES,renderParts,inRegion,jointWeights} from './body-data.js';

const $=s=>document.querySelector(s),stage=$('#stage'),video=$('#video');
let renderer,scene,camera,arCamera,controls,root,skeleton,bones=[],objects=[],organObjects=[],labels=[],region='upper',layer='both',motion='arms',angle=0,playing=false,loaded=false,mode='model',selected='ribs',selectedGroup='g_ribs',stream=null,pose=null,front=true,busy=false,epoch=0,loadEpoch=0,lastDetect=0,lastVideo=-1,tracked=false;
let detail=false,enabledZones=new Set(Object.keys(ZONES)),faceTracker=null,faceScores={};
let activity='observe',organGuard=false,organLoading=false,frozen=false,camSideView=false,camPreset='upper',speaking=false;
const organGeoCache=new Map();
const activeParts=()=>renderParts(region,detail,enabledZones);
const endpoints={R:{shoulder:[-.165,1.33,.07],elbow:[-.217,1.05,.07],wrist:[-.26,.825,.085],hip:[-.085,.815,.075],knee:[-.085,.412,.075],ankle:[-.085,.065,.065]},L:{shoulder:[.165,1.33,.07],elbow:[.217,1.05,.07],wrist:[.26,.825,.085],hip:[.085,.815,.075],knee:[.085,.412,.075],ankle:[.085,.065,.065]}};
const V=a=>new T.Vector3(...a),idx={R:{arm:1,forearm:2,thigh:5,shin:6},L:{arm:3,forearm:4,thigh:7,shin:8}},validLimbs={R:{arm:true,leg:true},L:{arm:true,leg:true}},flex={R:{arms:0,legs:0},L:{arms:0,legs:0}};
const nowMs=()=>globalThis.performance?performance.now():Date.now();
const status=s=>{const el=$('#status');if(el.textContent!==s)el.textContent=s};

// ── 카메라 추적 상태 ──
let rawLm=null,rawWorld=null,smLm=null,smWorld=null,lastSeen=0,detectCost=60,detectGap=100;
// ── 근육 상태: [관절, 1=굽힐 때 줄어듦 / -1=펼 때 줄어듦] ──
const PAIRS={biceps_brachii:['arms',1],brachialis:['arms',1],brachioradialis:['arms',1],triceps_brachii:['arms',-1],hamstrings:['legs',1],quads:['legs',-1]};
const work={R:{arms:[0,0],legs:[0,0]},L:{arms:[0,0],legs:[0,0]}},prevFlex={R:{arms:0,legs:0},L:{arms:0,legs:0}};
const LABEL_SETS={
  bone:{head:['skull'],upper:['skull','ribs','humerus','spine'],lower:['pelvis','femur','tibia'],full:['skull','ribs','humerus','spine','femur']},
  muscle:{head:['m_frontalis_head','m_orbicularis_oculi_head','m_orbicularis_oris_head','face'],upper:['biceps_brachii','triceps_brachii','pectoralis','rectus_abdominis'],lower:['quads','hamstrings','calf'],full:['biceps_brachii','triceps_brachii','quads','hamstrings']},
  both:{head:['m_frontalis_head','m_orbicularis_oculi_head','m_orbicularis_oris_head'],upper:['biceps_brachii','triceps_brachii','humerus','ribs'],lower:['quads','hamstrings','femur','pelvis'],full:['biceps_brachii','triceps_brachii','quads','hamstrings','skull']}
};
// 근육 길이 재기 기준점 (3D 모형 좌표, 편 때=100 기준 상대 길이 계산)
const MEASURE_ANCHORS={
  arms:{
    inner:{a:s=>[s==='R'?-.175:.175,1.30,.095],b:s=>[s==='R'?-.235:.235,.985,.088],bi:s=>[idx[s].arm,idx[s].forearm]},
    outer:{a:s=>[s==='R'?-.175:.175,1.29,.036],b:s=>[s==='R'?-.217:.217,1.032,.028],bi:s=>[idx[s].arm,idx[s].forearm]}
  },
  legs:{
    front:{a:s=>[s==='R'?-.092:.092,.78,.105],b:s=>[s==='R'?-.085:.085,.35,.112],bi:s=>[idx[s].thigh,idx[s].shin]},
    back:{a:s=>[s==='R'?-.088:.088,.77,.035],b:s=>[s==='R'?-.085:.085,.34,.055],bi:s=>[idx[s].thigh,idx[s].shin]}
  }
};
const REST_DIST={
  arms:{
    inner:V(MEASURE_ANCHORS.arms.inner.a('R')).distanceTo(V(MEASURE_ANCHORS.arms.inner.b('R'))),
    outer:V(MEASURE_ANCHORS.arms.outer.a('R')).distanceTo(V(MEASURE_ANCHORS.arms.outer.b('R')))
  },
  legs:{
    front:V(MEASURE_ANCHORS.legs.front.a('R')).distanceTo(V(MEASURE_ANCHORS.legs.front.b('R'))),
    back:V(MEASURE_ANCHORS.legs.back.a('R')).distanceTo(V(MEASURE_ANCHORS.legs.back.b('R')))
  }
};
const PROTECTIVE_BONES=new Set(['skull','ribs','sternum','costal']);

function init(){
  renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1));
  renderer.setClearColor(0,0);
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.3;
  stage.prepend(renderer.domElement);
  scene=new T.Scene();
  camera=new T.PerspectiveCamera(36,1,.01,30);
  arCamera=new T.OrthographicCamera(-1,1,1,-1,.01,30);
  arCamera.position.z=5;
  scene.add(new T.HemisphereLight(0xd7eaff,0x493128,2.2));
  const key=new T.DirectionalLight(0xffe7d1,3);key.position.set(1,2,3);scene.add(key);
  const rim=new T.DirectionalLight(0x91b9df,2);rim.position.set(-2,2,-3);scene.add(rim);
  controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.minDistance=.3;controls.maxDistance=6;
  makeRig();
  new ResizeObserver(resize).observe(stage);
  resize();
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();playing=false;stop();loaded=false;$('#loading').hidden=false;$('#loadingText').textContent='3D 표시가 중단됐어요. 페이지를 새로고침해 주세요.';status('3D 화면을 복구하려면 새로고침해 주세요.');setEnabled(false)});
  renderer.domElement.addEventListener('pointerdown',e=>{pointerStart=[e.clientX,e.clientY]});
  renderer.domElement.addEventListener('pointerup',pick);
}
function makeRig(){
  root=new T.Group();scene.add(root);
  const pivots=[[0,0,0],endpoints.R.shoulder,endpoints.R.elbow,endpoints.L.shoulder,endpoints.L.elbow,endpoints.R.hip,endpoints.R.knee,endpoints.L.hip,endpoints.L.knee];
  bones=pivots.map(p=>{const b=new T.Bone();b.position.copy(V(p));b.userData.rest=V(p);root.add(b);return b});
  root.updateMatrixWorld(true);
  skeleton=new T.Skeleton(bones);
}
function activeCamera(){return mode==='camera'&&!frozen&&!camSideView?arCamera:camera}
function resize(){
  const w=stage.clientWidth||900,h=stage.clientHeight||640;
  renderer.setSize(w,h,false);
  camera.aspect=w/h;camera.updateProjectionMatrix();
  arCamera.left=-w/h;arCamera.right=w/h;arCamera.updateProjectionMatrix();
  if(mode==='model'&&!loaded)setView('front');
}
function setView(view){
  const r=REGIONS[region],h=Math.max(r.height,r.width/camera.aspect),d=h/(2*Math.tan(Math.PI/10))*1.08;
  controls.target.set(0,r.center,region==='head'?.10:.04);
  const delta={front:[0,0,d],side:[d*.94,.03,d*.34],back:[0,.02,-d]}[view];
  camera.position.copy(controls.target).add(V(delta));
  controls.update();
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',b.dataset.view===view)});
}
function zoomBy(factor){
  if(mode==='camera'&&!frozen&&!camSideView)return;
  const dir=camera.position.clone().sub(controls.target);
  const next=T.MathUtils.clamp(dir.length()*factor,controls.minDistance,controls.maxDistance);
  dir.setLength(next);
  camera.position.copy(controls.target).add(dir);
  controls.update();
}
function boneIndices(data,side,y){
  if(data.segment==='torso')return [0,0,1,0];
  const map=idx[side];
  if(data.segment==='shoulder'){const w=jointWeights(data,y)[0];return [map.arm,0,w,1-w]}
  if(data.tissue==='bone')return [map[data.segment],0,1,0];
  const [w1,w2]=jointWeights(data,y);
  const leg=['thigh','shin'].includes(data.segment);
  return [map[leg?'thigh':'arm'],map[leg?'shin':'forearm'],w1,w2];
}
function addMesh(source,data,side){
  source.updateWorldMatrix(true,false);
  const geo=source.geometry.clone();geo.applyMatrix4(source.matrixWorld);
  if(side==='L'){geo.scale(-1,1,1);if(geo.index){const a=geo.index.array;for(let i=0;i<a.length;i+=3){const v=a[i+1];a[i+1]=a[i+2];a[i+2]=v}}}
  geo.computeVertexNormals();
  const p=geo.attributes.position,skinI=[],skinW=[],target=p.array.slice(),teachingRest=p.array.slice(),teachingBent=p.array.slice();
  const morph=['biceps_brachii','triceps_brachii','brachialis','quads','hamstrings'].includes(data.id);
  for(let i=0;i<p.count;i++){
    const y=p.getY(i),x=p.getX(i),z=p.getZ(i);
    const [a,b,u,v]=boneIndices(data,side,y);
    skinI.push(a,b,0,0);skinW.push(u,v,0,0);
    if(morph){
      const arm=data.region==='upper',lo=arm?1.075:.44,hi=arm?1.31:.78,center=(lo+hi)/2,t=T.MathUtils.clamp((y-lo)/(hi-lo),0,1),e=Math.sin(t*Math.PI);
      const contract={biceps_brachii:.38,brachialis:.26,hamstrings:.30,triceps_brachii:-.18,quads:-.14}[data.id];
      const cx=(side==='R'?-1:1)*(arm?(.217-(y-1.05)*.19):.095);
      const cz=arm?(data.id==='triceps_brachii'?.044:.092):.055;
      // 옆면 시점에서 팔 안쪽 근육의 볼록함이 또렷하게 드러나도록 앞쪽(+Z) 부풀림 강화
      const frontBoost=data.id==='biceps_brachii'&&z>cz?2.05:1.45;
      target[i*3]=cx+(x-cx)*(1+contract*e);
      target[i*3+1]=y-(y-center)*contract*e;
      target[i*3+2]=cz+(z-cz)*(1+contract*frontBoost*e);
      // Opposing muscles exchange long/thin and short/thick shapes in lesson 2.
      const flexor=contract>0;
      teachingRest.set(teachingMuscleVertex(x,y,z,cx,center,cz,e,flexor?0:1),i*3);
      teachingBent.set(teachingMuscleVertex(x,y,z,cx,center,cz,e,flexor?1:0),i*3);
    }
  }
  geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinI,4));
  geo.setAttribute('skinWeight',new T.Float32BufferAttribute(skinW,4));
  if(morph){geo.morphAttributes.position=[new T.Float32BufferAttribute(target,3),new T.Float32BufferAttribute(teachingRest,3),new T.Float32BufferAttribute(teachingBent,3)];geo.morphTargetsRelative=false}
  const muscle=data.tissue==='muscle';
  const material=new T.MeshStandardMaterial({color:data.color,roughness:muscle?.62:.75,transparent:muscle,opacity:muscle?+$('#opacity').value/100:1,depthWrite:!muscle,side:T.DoubleSide});
  const mesh=new T.SkinnedMesh(geo,material);mesh.name=data.id;mesh.frustumCulled=false;
  root.add(mesh);mesh.bind(skeleton,new T.Matrix4());
  const bounds=new T.Box3().setFromBufferAttribute(p),center=bounds.getCenter(new T.Vector3());
  objects.push({mesh,data,side,center});
}
function addOrganMesh(geoSource,organ){
  const geo=geoSource.clone();
  const p=geo.attributes.position,skinI=[],skinW=[];
  for(let i=0;i<p.count;i++){skinI.push(0,0,0,0);skinW.push(1,0,0,0)}
  geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinI,4));
  geo.setAttribute('skinWeight',new T.Float32BufferAttribute(skinW,4));
  const soft=organ.id==='lungs';
  const mat=new T.MeshStandardMaterial({color:organ.color,roughness:.45,metalness:.05,transparent:soft,opacity:soft?.68:1,depthWrite:!soft,side:T.DoubleSide});
  const mesh=new T.SkinnedMesh(geo,mat);mesh.name=organ.id;mesh.frustumCulled=false;mesh.renderOrder=soft?2:1;
  root.add(mesh);mesh.bind(skeleton,new T.Matrix4());
  const bounds=new T.Box3().setFromBufferAttribute(p),center=bounds.getCenter(new T.Vector3());
  organObjects.push({mesh,data:organ,side:'R',center});
}
async function ensureOrgans(){
  if(organObjects.length||organLoading)return;
  organLoading=true;
  status('뇌·심장·폐 모형을 불러오고 있어요…');
  const draco=new DRACOLoader().setDecoderPath('./vendor/').setWorkerLimit(1);
  const loader=new GLTFLoader().setDRACOLoader(draco);
  try{
    for(const organ of ORGANS){
      if(!organGeoCache.has(organ.id)){
        const gltf=await loader.loadAsync(organ.url);
        gltf.scene.updateMatrixWorld(true);
        const geos=[];
        gltf.scene.traverse(o=>{if(o.isMesh){const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);g.computeVertexNormals();geos.push(g);o.geometry.dispose();o.material.dispose()}});
        organGeoCache.set(organ.id,geos);
      }
      for(const g of organGeoCache.get(organ.id)||[])addOrganMesh(g,organ);
    }
  }catch(e){
    console.error('Organ load failed',e);
    status('기관 모형을 불러오지 못했어요.');
  }finally{
    draco.dispose();
    organLoading=false;
  }
}
function disposeScene(){
  objects.forEach(o=>{o.mesh.geometry.dispose();o.mesh.material.dispose()});objects=[];
  organObjects.forEach(o=>{o.mesh.geometry.dispose();o.mesh.material.dispose()});organObjects=[];
  labels.forEach(x=>x.el.remove());labels=[];
  if(root){scene.remove(root);skeleton?.dispose()}
  makeRig();
}
function setEnabled(on){
  $('#cameraMode').disabled=!on||busy;
  $('#play').disabled=!on||mode==='camera'||region==='head';
  $('#bend').disabled=!on||mode==='camera'||region==='head';
}
async function loadRegion(next){
  if(!REGIONS[next])return;
  const resume=mode==='camera',previous=selected,prevGroup=selectedGroup;
  stop();
  const token=++loadEpoch;region=next;loaded=false;playing=false;
  $('#play').textContent='▶ 자동 움직임';
  setEnabled(false);disposeScene();
  selected=region==='head'?'m_orbicularis_oculi_head':region==='lower'?'g_leg_bone':'g_ribs';
  selectedGroup=region==='head'?'g_face_muscle':region==='lower'?'g_leg_bone':'g_ribs';
  motion=region==='lower'?'legs':'arms';angle=0;
  syncRegion();setView('front');
  $('#loading').hidden=false;
  $('#loadingText').textContent='해부학 모형을 준비하고 있어요…';
  $('#loadBar').style.width='10%';
  const entries=activeParts();
  if(TEXTBOOK_GROUPS.some(g=>g.id===previous)){selected=previous;selectedGroup=prevGroup}
  else if(entries.some(p=>p.id===previous)){selected=previous;selectedGroup=prevGroup}
  else if(!entries.some(p=>p.id===selected)&&!TEXTBOOK_GROUPS.some(g=>g.id===selected)){selected=entries[0]?.id||null}
  const draco=new DRACOLoader().setDecoderPath('./vendor/').setWorkerLimit(1);
  const loader=new GLTFLoader().setDRACOLoader(draco);
  let cursor=0,done=0;const errors=[];
  const worker=async()=>{
    while(cursor<entries.length&&token===loadEpoch){
      const d=entries[cursor++];
      try{
        const gltf=await loader.loadAsync(d.url);
        if(token!==loadEpoch){gltf.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose()}});break}
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse(o=>{if(o.isMesh){addMesh(o,d,'R');if(d.pair)addMesh(o,d,'L');o.geometry.dispose();o.material.dispose()}});
        done++;
        const pct=Math.max(10,Math.round(done/Math.max(1,entries.length)*100));
        $('#loadBar').style.width=pct+'%';
        $('#loadingText').innerHTML=`${REGIONS[region].title} 모형 불러오는 중<span class="loading-progress">${done} / ${entries.length} 부위 (${pct}%)</span>`;
      }catch(e){errors.push(d.label);console.error('Model load failed',d.id,e)}
    }
  };
  await Promise.all([worker(),worker(),worker()]);
  draco.dispose();
  if(token!==loadEpoch)return;
  if(errors.length){$('#loadingText').textContent='일부 모델을 불러오지 못했어요: '+errors.join(', ');status('모형 로딩이 완료되지 않았어요.');return}
  if(organGuard&&region!=='lower')await ensureOrgans();
  loaded=true;$('#loading').hidden=true;setEnabled(true);
  buildParts();setMotion(motion);updateDemo(0);select(selected);updateRenderCount();
  status(`${REGIONS[region].title} · 손가락이나 마우스로 돌려 보고 뼈와 근육을 관찰해요.`);
  window.__bodyReady={region,meshes:objects.length,vertices:objects.reduce((s,o)=>s+o.mesh.geometry.attributes.position.count,0),detail,zones:[...enabledZones],organs:organObjects.length};
  if(resume&&entries.length)await start();
}
function syncRegion(){
  for(const el of document.querySelectorAll('[data-zone]')){el.disabled=!PARTS.some(p=>p.zone===el.dataset.zone&&inRegion(p,region));el.checked=enabledZones.has(el.dataset.zone)}
  $('#motionPanel').hidden=region==='head';
  $('#motionDiscovery').hidden=region==='head';
  $('#faceLesson').hidden=region!=='head';
  document.querySelectorAll('[data-region]').forEach(b=>{b.classList.toggle('active',b.dataset.region===region);b.setAttribute('aria-pressed',b.dataset.region===region)});
  $('#viewTitle').textContent=REGIONS[region].title+' · 3D 해부학 모형';
  $('#regionHint').textContent=REGIONS[region].hint;
  document.querySelector('[data-motion="arms"]').hidden=false;
  document.querySelector('[data-motion="legs"]').hidden=false;
}
function buildParts(){
  const q=$('#partSearch').value.trim().toLowerCase();
  $('#parts').replaceChildren();
  if(q){
    // 검색어가 있을 때는 세부 부위에서 바로 찾아 표시
    for(const d of activeParts().filter(p=>(p.label+' '+(p.academic||'')+' '+(p.english||'')).toLowerCase().includes(q))){
      const b=document.createElement('button');b.dataset.part=d.id;
      b.innerHTML=`<i style="background:#${d.color.toString(16).padStart(6,'0')}"></i>${d.label}`;
      b.onclick=()=>select(d.id);
      $('#parts').append(b);
    }
  }else{
    // 기본 화면: 교과서 10개 부위 (뼈 5개 · 근육 5개)
    for(const g of TEXTBOOK_GROUPS){
      const b=document.createElement('button');b.dataset.part=g.id;
      b.innerHTML=`<i style="background:#${g.color.toString(16).padStart(6,'0')}"></i>${g.label}`;
      b.onclick=()=>selectGroup(g.id);
      $('#parts').append(b);
    }
  }
  // 더 알아보기: 38개 세부 부위(및 상세 근육)
  const more=$('#moreParts');
  more.replaceChildren();
  const list=activeParts().filter(p=>!q||(p.label+' '+(p.academic||'')+' '+(p.english||'')).toLowerCase().includes(q));
  for(const g of TEXTBOOK_GROUPS){
    const sub=list.filter(p=>p.group===g.id);
    if(!sub.length)continue;
    const h=document.createElement('div');h.className='more-group-title';h.textContent=g.label;more.append(h);
    for(const d of sub){
      const b=document.createElement('button');b.dataset.part=d.id;
      const ac=d.academic&&d.academic!==d.label?`<small>${d.academic}</small>`:'';
      b.innerHTML=`<span>${d.label}</span>${ac}`;
      b.onclick=()=>select(d.id);
      more.append(b);
    }
  }
}
async function selectGroup(gid){
  const g=TEXTBOOK_GROUPS.find(x=>x.id===gid);
  if(!g)return;
  if(g.region==='lower'&&region==='upper'){
    selected=gid;selectedGroup=gid;
    await loadRegion('full');
    return;
  }
  if(g.region==='upper'&&region==='lower'){
    selected=gid;selectedGroup=gid;
    await loadRegion('full');
    return;
  }
  selected=gid;selectedGroup=gid;
  $('#partInfo').innerHTML=`<strong>${g.label}</strong><p>${g.description}</p>${g.more?`<div class="part-more-note">더 알아보기: ${g.more}</div>`:''}`;
  $('#boneFunctionsCard').hidden=g.tissue!=='bone';
  if(layer!=='both'&&layer!==g.tissue&&!organGuard)layer=g.tissue;
  if(organGuard){
    if(gid==='g_skull')$('#organBanner').textContent='🛡️ 뼈가 뇌를 감싸 보호해요.';
    else if(gid==='g_ribs')$('#organBanner').textContent='🛡️ 갈비뼈가 심장과 폐를 감싸 보호해요.';
    else $('#organBanner').textContent='🛡️ 뼈가 뇌를 감싸 보호해요 · 갈비뼈가 심장과 폐를 보호해요.';
  }
  document.querySelectorAll('[data-part]').forEach(b=>{b.classList.toggle('active',b.dataset.part===gid);b.setAttribute('aria-pressed',b.dataset.part===gid)});
  applyVisibility();buildLabels();
}
function select(id){
  const grp=TEXTBOOK_GROUPS.find(g=>g.id===id);
  if(grp){selectGroup(grp.id);return}
  const org=ORGANS.find(o=>o.id===id);
  if(org){
    selected=id;selectedGroup=org.protector;
    $('#partInfo').innerHTML=`<strong>${org.label} <small>(보호받는 기관)</small></strong><p>${org.description}</p>`;
    $('#boneFunctionsCard').hidden=false;
    $('#organBanner').textContent='🛡️ '+org.banner;
    applyVisibility();buildLabels();
    return;
  }
  selected=id;
  const d=PARTS.find(p=>p.id===id);
  if(!d){$('#partInfo').textContent='표시할 부위를 켜 주세요.';applyVisibility();buildLabels();return}
  selectedGroup=d.group||null;
  const ac=d.academic&&d.academic!==d.label?` <small>(${d.academic})</small>`:'';
  const moreHtml=d.moreInfo?`<div class="part-more-note">더 알아보기: ${d.moreInfo}</div>`:'';
  $('#partInfo').innerHTML=`<strong>${d.label}${ac}</strong><p>${d.description}</p>${moreHtml}`;
  $('#boneFunctionsCard').hidden=d.tissue!=='bone';
  if(layer!=='both'&&layer!==d.tissue&&!organGuard)layer=d.tissue;
  document.querySelectorAll('[data-part]').forEach(b=>{const on=b.dataset.part===id||b.dataset.part===selectedGroup;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on)});
  applyVisibility();buildLabels();
}
function isHighlighted(o){
  if(mode!=='model'&&!frozen)return false;
  if(o.data.id===selected)return true;
  if(TEXTBOOK_GROUPS.some(g=>g.id===selected)&&o.data.group===selected)return true;
  return false;
}
function meshVisibility(){
  const op=+$('#opacity').value/100;
  for(const o of objects){
    const d=o.data;
    let visible=(layer==='both'||layer===d.tissue)&&(!$('#isolate').checked||selected===d.id||(TEXTBOOK_GROUPS.some(g=>g.id===selected)&&d.group===selected));
    const limb=['arm','forearm','shoulder'].includes(d.segment)?'arm':['thigh','shin'].includes(d.segment)?'leg':null;
    if(mode==='camera'&&!frozen&&limb)visible=visible&&validLimbs[o.side][limb];
    if(organGuard){
      if(d.tissue==='muscle')visible=false;
      if(d.tissue==='bone'){
        const protect=PROTECTIVE_BONES.has(d.id);
        o.mesh.visible=visible||protect;
        o.mesh.material.transparent=protect;
        o.mesh.material.opacity=protect?.28:1;
        o.mesh.material.depthWrite=!protect;
        o.mesh.renderOrder=protect?3:1;
        tint(o);continue;
      }
    }
    o.mesh.visible=visible;
    o.mesh.material.transparent=d.tissue==='muscle';
    o.mesh.material.opacity=d.tissue==='muscle'?op:1;
    o.mesh.material.depthWrite=d.tissue!=='muscle'||op===1;
    o.mesh.renderOrder=d.tissue==='muscle'?2:1;
    tint(o);
  }
  for(const o of organObjects){
    o.mesh.visible=organGuard&&(region!=='lower')&&(region!=='head'||o.data.id==='brain');
    o.mesh.material.emissive.setHex(o.data.id===selected?0x451721:0x1b080c);
    o.mesh.material.emissiveIntensity=o.data.id===selected?.45:.18;
  }
}
function tint(o){
  const m=o.mesh.material,p=PAIRS[o.data.id],g=mode==='camera'&&!frozen&&region==='head'?faceActivity(o.data.english):p?work[o.side][p[0]][p[1]>0?0:1]:0;
  if(g>.03){m.emissive.setHex(0xffb340);m.emissiveIntensity=g*.8}
  else if(isHighlighted(o)){m.emissive.setHex(0x2d4866);m.emissiveIntensity=.38}
  else{m.emissive.setHex(0);m.emissiveIntensity=0}
}
function updateWork(dt){
  if(dt<=0)return;
  const k=1-Math.exp(-dt/260);
  for(const s of ['R','L'])for(const j of ['arms','legs']){
    const v=(flex[s][j]-prevFlex[s][j])/(dt/1000);prevFlex[s][j]=flex[s][j];
    const w=work[s][j];
    w[0]+=(T.MathUtils.clamp((v-30)/60,0,1)-w[0])*k;
    w[1]+=(T.MathUtils.clamp((-v-30)/60,0,1)-w[1])*k;
  }
}
// 굽힌 상태를 유지할 때도 이름표에 '줄어듦 · 볼록' / '늘어남 · 평평'이 계속 유지됨
function muscleState(id,side){
  const p=PAIRS[id];if(!p)return '';
  const f=flex[side][p[0]]/125,x=p[1]>0?f:1-f;
  return x>.45?'short':x<.35?'long':'';
}
function applyVisibility(){
  meshVisibility();
  $('#opacityValue').textContent=$('#opacity').value+'%';
  document.querySelectorAll('[data-layer]').forEach(b=>{b.classList.toggle('active',!organGuard&&b.dataset.layer===layer);b.setAttribute('aria-pressed',!organGuard&&b.dataset.layer===layer)});
  $('#organGuardBtn').classList.toggle('active',organGuard);
  $('#organGuardBtn').setAttribute('aria-pressed',organGuard);
  $('#organBanner').hidden=!organGuard;
}
function labelDisplayName(d){
  if(d.id==='humerus')return '팔뼈';
  if(d.id==='femur')return '다리뼈';
  return d.label;
}
function buildLabels(){
  labels.forEach(x=>x.el.remove());labels=[];
  if(organGuard){
    for(const o of organObjects){
      const el=document.createElement('div');el.className='annotation organ-tag';
      el.style.setProperty('--color','#'+o.data.color.toString(16).padStart(6,'0'));
      const dot=document.createElement('b'),name=document.createElement('span'),em=document.createElement('em');
      name.textContent=o.data.label;el.append(dot);el.append(name);el.append(em);
      $('#labels').append(el);
      labels.push({el,em,objs:{R:o,L:null},id:o.data.id,state:null,isOrgan:true});
    }
    return;
  }
  const defaults=LABEL_SETS[layer][region];
  const selPart=PARTS.find(p=>p.id===selected)?selected:PARTS.find(p=>p.group===selected&&inRegion(p,region))?.id;
  const ids=$('#isolate').checked?[selPart].filter(Boolean):mode==='camera'?defaults:[...new Set([selPart,...defaults].filter(Boolean))].slice(0,5);
  for(const id of ids){
    const objs={R:objects.find(o=>o.data.id===id&&o.side==='R'),L:objects.find(o=>o.data.id===id&&o.side==='L')};
    if(!objs.R)continue;
    const el=document.createElement('div');el.className='annotation';
    el.style.setProperty('--color','#'+objs.R.data.color.toString(16).padStart(6,'0'));
    const dot=document.createElement('b'),name=document.createElement('span'),em=document.createElement('em');
    const ac=objs.R.data.academic&&['biceps_brachii','triceps_brachii','quads','hamstrings'].includes(id)?` <small>(${objs.R.data.academic})</small>`:'';
    name.innerHTML=labelDisplayName(objs.R.data)+ac;
    el.append(dot);el.append(name);el.append(em);
    $('#labels').append(el);
    labels.push({el,em,objs,id,state:null,isOrgan:false});
  }
}
function computeMuscleLengths(side='R'){
  const m=motion==='legs'?'legs':'arms';
  const cfg=MEASURE_ANCHORS[m];
  const keys=m==='arms'?['inner','outer']:['front','back'];
  const out={};
  for(const k of keys){
    const item=cfg[k];
    const [b1,b2]=item.bi(side);
    const p1=V(item.a(side)).applyMatrix4(new T.Matrix4().fromArray(skeleton.boneMatrices,b1*16));
    const p2=V(item.b(side)).applyMatrix4(new T.Matrix4().fromArray(skeleton.boneMatrices,b2*16));
    const dist=p1.distanceTo(p2);
    const rel=Math.max(45,Math.min(145,Math.round(dist/REST_DIST[m][k]*100)));
    out[k]={p1,p2,rel};
  }
  return out;
}
function labelsUpdate(){
  root.updateMatrixWorld(true);skeleton.update();
  const cam=activeCamera(),W=stage.clientWidth||900,H=stage.clientHeight||640,placed=[],lines=[];
  const show=$('#names').checked&&root.visible;
  const c=new T.Vector3(0,REGIONS[region].center,.07).applyMatrix4(root.matrixWorld).project(cam),cx=(c.x+1)*W/2;
  for(const L of labels){
    const {el,objs,id,isOrgan}=L;const p=PAIRS[id];
    let sides=['R','L'].filter(s=>objs[s]&&objs[s].mesh.visible);
    if(p&&sides.length===2)sides.sort((a,b)=>flex[b][p[0]]-flex[a][p[0]]);
    const obj=objs[sides[0]];el.hidden=!show||!obj;if(el.hidden)continue;
    const pt=obj.center.clone();
    const bi=isOrgan?0:boneIndices(obj.data,obj.side,pt.y)[0];
    pt.applyMatrix4(new T.Matrix4().fromArray(skeleton.boneMatrices,bi*16)).applyMatrix4(root.matrixWorld).project(cam);
    const ax=(pt.x+1)*W/2,ay=(1-pt.y)*H/2;
    const sign=mode==='camera'&&!frozen&&!camSideView?(ax<cx?-1:1):(id===selected||isOrgan?1:-1);
    let x=ax+sign*(region==='full'?80:100),y=ay;
    x=T.MathUtils.clamp(x,90,W-90);y=T.MathUtils.clamp(y,mode==='camera'?30:86,H-46);
    for(const v of placed)if(Math.abs(v.x-x)<160&&Math.abs(v.y-y)<31)y=v.y+33;
    placed.push({x,y});
    el.style.left=x+'px';el.style.top=y+'px';el.hidden=pt.z>1||pt.z<-1;if(el.hidden)continue;
    lines.push(`<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="3"/>`);
    const st=muscleState(id,obj.side);
    if(st!==L.state){
      L.state=st;L.em.className=st;
      L.em.textContent=st==='short'?'줄어듦 · 볼록':st==='long'?'늘어남 · 평평':'';
    }
  }
  // 2차시(움직임 관찰) 또는 굽힘 중일 때 안쪽 근육 시작~끝 길이 측정선 표시
  if(show&&!organGuard&&region!=='head'&&layer!=='bone'&&(activity==='motion'||angle>5||mode==='camera')){
    const side=flex.L[motion]>flex.R[motion]?'L':'R';
    const limbKey=motion==='arms'?'arm':'leg';
    if(mode!=='camera'||frozen||validLimbs[side][limbKey]){
      const m=computeMuscleLengths(side);
      const focus=motion==='arms'?m.inner:m.back;
      const a=focus.p1.clone().applyMatrix4(root.matrixWorld).project(cam);
      const b=focus.p2.clone().applyMatrix4(root.matrixWorld).project(cam);
      if(a.z<1&&a.z>-1&&b.z<1&&b.z>-1){
        const x1=(a.x+1)*W/2,y1=(1-a.y)*H/2,x2=(b.x+1)*W/2,y2=(1-b.y)*H/2;
        const mx=(x1+x2)/2+(x1<W/2?-52:52),my=Math.min(y1,y2)-14;
        lines.push(`<line class="measure-line" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`);
        lines.push(`<circle class="measure-dot" cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="4.5"/><circle class="measure-dot" cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="4.5"/>`);
        lines.push(`<text class="measure-label" x="${T.MathUtils.clamp(mx,64,W-64).toFixed(1)}" y="${T.MathUtils.clamp(my,72,H-54).toFixed(1)}" text-anchor="middle">길이 100→${focus.rel}</text>`);
      }
      updateLengthReadout(m);
    }
  }
  const svg=$('#leaders'),html=lines.join('');if(svg.__h!==html){svg.innerHTML=html;svg.__h=html}
}
function updateLengthReadout(m){
  const arm=motion==='arms';
  const fRel=arm?m.inner.rel:m.front.rel;
  const bRel=arm?m.outer.rel:m.back.rel;
  $('#frontBaseLen').textContent='100';
  $('#backBaseLen').textContent='100';
  $('#frontNowLen').textContent=String(fRel);
  $('#backNowLen').textContent=String(bRel);
}
function setMotion(m){
  motion=m;
  document.querySelectorAll('[data-motion]').forEach(b=>{b.classList.toggle('active',b.dataset.motion===m);b.setAttribute('aria-pressed',b.dataset.motion===m)});
  $('#jointTitle').textContent=m==='arms'?'팔 굽힘':'다리(무릎) 굽힘';
  $('#frontMuscle').innerHTML='<i class="red"></i>'+(m==='arms'?'팔 안쪽 근육 <small>(이두근)</small>':'허벅지 앞쪽 근육 <small>(넙다리네갈래근)</small>');
  $('#backMuscle').innerHTML='<i class="blue"></i>'+(m==='arms'?'팔 바깥쪽 근육 <small>(삼두근)</small>':'허벅지 뒤쪽 근육 <small>(넙다리뒤근육)</small>');
  $('#motionLesson').textContent=m==='arms'
    ?'팔을 굽히면 팔 안쪽 근육의 길이가 줄어들고 볼록해지며, 팔 바깥쪽 근육은 길이가 늘어나고 평평해져요. 뼈의 길이는 그대로예요.'
    :'무릎을 굽히면 허벅지 뒤쪽 근육의 길이가 줄어들고 볼록해지며, 허벅지 앞쪽 근육은 길이가 늘어나고 평평해져요. 뼈의 길이는 그대로예요.';
  if(mode==='model')updateDemo(angle);
}
function resetBones(){bones.forEach(b=>{b.position.copy(b.userData.rest);b.quaternion.identity();b.scale.setScalar(1)})}
function updateDemo(v){
  angle=T.MathUtils.clamp(v,0,125);resetBones();
  for(const side of ['R','L']){
    flex[side].arms=motion==='arms'?angle:0;
    flex[side].legs=motion==='legs'?angle:0;
    bones[idx[side].forearm].quaternion.setFromAxisAngle(new T.Vector3(1,0,0),-flex[side].arms*Math.PI/180);
    bones[idx[side].shin].quaternion.setFromAxisAngle(new T.Vector3(1,0,0),flex[side].legs*Math.PI/180);
  }
  morphUpdate();
  root.updateMatrixWorld(true);skeleton.update();
  updateLengthReadout(computeMuscleLengths('R'));
  lesson(angle);
}
function morphUpdate(){
  for(const o of objects)if(o.mesh.morphTargetInfluences){
    const limb=o.data.region==='upper'?'arms':'legs';
    const weights=teachingMorphWeights(flex[o.side][limb],activity==='motion'&&mode==='model'&&motion===limb);
    weights.forEach((w,i)=>o.mesh.morphTargetInfluences[i]=w);
  }
}
function lesson(v){
  $('#angle').textContent=Math.round(v);$('#bend').value=v;
  const f=T.MathUtils.clamp(v/125,0,1),arm=motion==='arms';
  $('#bicepsState').textContent=arm?(f<.25?'늘어남 · 평평':f>.45?'줄어듦 · 볼록':'점점 줄어듦'):(f<.25?'줄어듦 · 볼록':f>.45?'늘어남 · 평평':'점점 늘어남');
  $('#tricepsState').textContent=arm?(f<.25?'줄어듦 · 볼록':f>.45?'늘어남 · 평평':'점점 늘어남'):(f<.25?'늘어남 · 평평':f>.45?'줄어듦 · 볼록':'점점 줄어듦');
  $('#bicepsMeter').style.width=(arm?90-50*f:40+50*f)+'%';
  $('#tricepsMeter').style.width=(arm?40+50*f:90-50*f)+'%';
}
function stop(){
  epoch++;
  stream?.getTracks().forEach(t=>t.stop());stream=null;
  video.srcObject=null;video.hidden=true;
  mode='model';tracked=false;frozen=false;camSideView=false;
  if(root){root.matrixAutoUpdate=true;root.position.set(0,0,0);root.rotation.set(0,0,0);root.scale.setScalar(1);root.updateMatrix();root.visible=true;resetBones()}
  if(controls)controls.enabled=true;
  for(const s of ['R','L'])validLimbs[s]={arm:true,leg:true};
  $('#flip').hidden=true;$('#stopCamera').hidden=true;$('#cameraActions').hidden=true;$('#freezeBadge').hidden=true;
  $('#freezeBtn').textContent='⏸ 멈추기';$('#freezeBtn').classList.remove('active');
  $('#sideViewCamBtn').textContent='↻ 옆에서 보기';$('#sideViewCamBtn').classList.remove('active');
  $('.viewtools').hidden=false;
  $('#modelMode').classList.add('active');$('#cameraMode').classList.remove('active');
  $('#gesture').textContent='손가락으로 돌려 보고, 확대·축소 버튼으로 크게 보세요';
  syncRegion();setEnabled(loaded);
  rawLm=rawWorld=smLm=smWorld=null;faceScores={};
  if(bones.length)updateDemo(angle);
  applyVisibility();buildLabels();
}
async function start(){
  if(busy||!loaded)return;
  stop();busy=true;const token=epoch;playing=false;$('#play').textContent='▶ 자동 움직임';
  setEnabled(false);$('#flip').disabled=true;
  status('카메라와 자세 인식을 준비하고 있어요…');
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw Error('unsupported');
    const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:front?'user':'environment',width:{ideal:640},height:{ideal:480},frameRate:{ideal:15,max:20}},audio:false});
    if(token!==epoch){s.getTracks().forEach(t=>t.stop());return}
    stream=s;video.srcObject=s;await video.play();
    if(region==='head'){
      pose?.close();pose=null;
      if(!faceTracker){
        const {FilesetResolver,FaceLandmarker}=await import('./vendor/vision_bundle.mjs');
        faceTracker=await FaceLandmarker.createFromOptions(await FilesetResolver.forVisionTasks('./vendor'),{baseOptions:{modelAssetPath:'./vendor/face.task',delegate:'CPU'},runningMode:'VIDEO',numFaces:1,minFaceDetectionConfidence:.6,minTrackingConfidence:.6,outputFaceBlendshapes:true});
      }
    }else{
      faceTracker?.close();faceTracker=null;
      if(!pose){
        const {FilesetResolver,PoseLandmarker}=await import('./vendor/vision_bundle.mjs');
        pose=await PoseLandmarker.createFromOptions(await FilesetResolver.forVisionTasks('./vendor'),{baseOptions:{modelAssetPath:'./vendor/pose.task',delegate:'CPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.6,minTrackingConfidence:.6});
      }
    }
    if(token!==epoch)return;
    mode='camera';frozen=false;camSideView=false;rawLm=rawWorld=smLm=smWorld=null;lastSeen=nowMs();
    buildLabels();
    video.hidden=false;video.style.transform=front?'scaleX(-1)':'none';
    root.visible=false;root.matrixAutoUpdate=false;controls.enabled=false;
    $('#flip').hidden=false;$('#stopCamera').hidden=false;$('#cameraActions').hidden=false;
    $('.viewtools').hidden=true;
    $('#modelMode').classList.remove('active');$('#cameraMode').classList.add('active');
    $('#viewTitle').textContent=REGIONS[region].title+' · 정면 카메라';
    $('#gesture').textContent=region==='head'?'얼굴 전체를 밝게 비춰 주세요 · 미소 짓거나 눈을 깜빡여 보세요':'정면을 보고 천천히 움직여 보세요 · 멈추기와 옆에서 보기를 눌러 보세요';
    lastVideo=-1;
    status('정면을 보고 천천히 움직여 보세요.');
  }catch(e){
    if(token!==epoch)return;
    stop();
    status(e.name==='NotAllowedError'?'카메라 권한을 허용해 주세요. 3D 모형은 계속 사용할 수 있어요.':e.name==='NotFoundError'?'카메라를 찾지 못했어요. 웹캠 연결을 확인해 주세요.':'카메라를 시작하지 못했어요. HTTPS 주소와 다른 카메라 앱을 확인해 주세요.');
  }finally{busy=false;setEnabled(loaded);$('#flip').disabled=false}
}
function toggleFreeze(){
  if(mode!=='camera')return;
  frozen=!frozen;
  $('#freezeBtn').textContent=frozen?'▶ 다시 움직이기':'⏸ 멈추기';
  $('#freezeBtn').classList.toggle('active',frozen);
  $('#freezeBadge').hidden=!frozen;
  if(frozen){
    // 사람 얼굴·카메라 영상 없이 뼈·근육 모형만 깨끗하게 멈춤
    video.hidden=true;
    root.matrixAutoUpdate=true;root.position.set(0,0,0);root.rotation.set(0,0,0);root.scale.setScalar(1);root.updateMatrix();root.visible=true;
    controls.enabled=true;$('.viewtools').hidden=false;
    setView(camSideView?'side':'front');
    applyVisibility();
    status('동작을 멈췄어요! 얼굴·배경 없이 모형만 남았어요. 옆으로 돌려 보거나 그림으로 저장해요.');
  }else{
    if(camSideView){
      video.hidden=true;root.matrixAutoUpdate=true;controls.enabled=true;$('.viewtools').hidden=false;
      setView('side');
    }else{
      video.hidden=false;root.matrixAutoUpdate=false;controls.enabled=false;$('.viewtools').hidden=true;
    }
    applyVisibility();
    status('카메라 추적을 다시 시작했어요.');
  }
}
function toggleCameraSideView(){
  if(mode!=='camera')return;
  camSideView=!camSideView;
  $('#sideViewCamBtn').textContent=camSideView?'↺ 정면 겹쳐 보기':'↻ 옆에서 보기';
  $('#sideViewCamBtn').classList.toggle('active',camSideView);
  if(frozen){
    setView(camSideView?'side':'front');
    status(camSideView?'멈춘 자세를 옆에서 보고 있어요. 팔 안쪽 근육의 볼록함을 확인해 보세요.':'멈춘 자세를 앞에서 보고 있어요.');
    return;
  }
  if(camSideView){
    // 카메라 입력은 정면 유지, 3D 모형만 옆면 시점으로 회전해 관찰
    video.hidden=true;
    root.matrixAutoUpdate=true;root.position.set(0,0,0);root.rotation.set(0,0,0);root.scale.setScalar(1);root.updateMatrix();root.visible=true;
    controls.enabled=true;$('.viewtools').hidden=false;
    setView('side');
    status('정면을 보고 팔을 굽혀 보세요! 3D 모형을 옆면 시점으로 보여 주고 있어요.');
  }else{
    video.hidden=false;
    root.matrixAutoUpdate=false;controls.enabled=false;$('.viewtools').hidden=true;
    status('정면 카메라 겹쳐 보기로 돌아왔어요.');
  }
}
function saveModelPng(){
  // 카메라 영상 픽셀을 절대 포함하지 않고 WebGL 3D 모형만 PNG로 저장 (개인정보 보호)
  const w=renderer.domElement.width||stage.clientWidth||900;
  const h=renderer.domElement.height||stage.clientHeight||720;
  const out=document.createElement('canvas');out.width=w;out.height=h;
  const ctx=out.getContext('2d');
  if(!ctx){status('이 브라우저에서는 그림 저장을 지원하지 않아요.');return}
  const grad=ctx.createRadialGradient(w/2,h*.45,20,w/2,h*.45,Math.max(w,h)*.75);
  grad.addColorStop(0,'#253b51');grad.addColorStop(1,'#101c2a');
  ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
  // 현재 모형 프레임만 즉시 렌더 (비디오 제외)
  const prevVis=root.visible;root.visible=true;
  renderer.render(scene,activeCamera());
  root.visible=prevVis;
  ctx.drawImage(renderer.domElement,0,0,w,h);
  // 하단 활동 안내 바
  ctx.fillStyle='rgba(14,29,45,0.82)';ctx.fillRect(0,h-42,w,42);
  ctx.fillStyle='#e8f0f8';ctx.font='bold 16px sans-serif';
  ctx.fillText('무슨 운동일까? · 움직임 탐구실 (뼈·근육 모형만 저장됨)',16,h-16);
  const url=out.toDataURL('image/png');
  const a=document.createElement('a');a.href=url;a.download='body-motion-pose.png';
  a.click?.();
  status('뼈·근육 모형만 PNG 그림으로 저장했어요! (사람 얼굴과 카메라 영상 제외)');
}

// ── 카메라 추적 ──
function detect(t){
  const tracker=region==='head'?faceTracker:pose;
  if(!stream||!tracker||video.readyState<2||video.currentTime===lastVideo||t-lastDetect<detectGap)return;
  lastDetect=t;lastVideo=video.currentTime;
  let res;const t0=nowMs();
  try{res=tracker.detectForVideo(video,t)}catch(e){stop();status('자세 인식이 중단됐어요. 카메라를 다시 시작해 주세요.');console.error(e);return}
  detectCost=detectCost*.8+(nowMs()-t0)*.2;detectGap=T.MathUtils.clamp(detectCost*1.6,33,160);
  const lm=region==='head'?res.faceLandmarks?.[0]?.map(p=>({...p,visibility:1})):res.landmarks&&res.landmarks[0];
  if(region==='head')faceScores=Object.fromEntries((res.faceBlendshapes?.[0]?.categories||[]).map(c=>[c.categoryName,c.score]));
  if(lm){rawLm=lm;rawWorld=res.worldLandmarks&&res.worldLandmarks[0]||null;lastSeen=t}
  else if(t-lastSeen>600){rawLm=rawWorld=smLm=smWorld=null;lose(region==='head'?'얼굴 전체가 화면에 보이게 해 주세요.':region==='lower'?'골반부터 발목까지 보이게 서 주세요.':'카메라 앞에 서 주세요. 머리부터 허리까지 보여야 해요.')}
}
function smoothStep(dt){
  if(!rawLm)return false;
  if(!smLm){smLm=rawLm.map(p=>({...p}));smWorld=rawWorld?rawWorld.map(p=>({...p})):null;return true}
  const base=1-Math.exp(-dt/85);
  if(rawWorld&&!smWorld)smWorld=rawWorld.map(p=>({...p}));
  for(let i=0;i<rawLm.length;i++){
    const s=smLm[i],r=rawLm[i],a=Math.min(1,base*(1+Math.hypot(r.x-s.x,r.y-s.y)*25))*T.MathUtils.clamp((r.visibility-.3)/.6,.2,1);
    s.x+=(r.x-s.x)*a;s.y+=(r.y-s.y)*a;if(Number.isFinite(r.z))s.z=(s.z||0)+(r.z-(s.z||0))*a;s.visibility=r.visibility;
    if(smWorld&&rawWorld){const w=smWorld[i],q=rawWorld[i];w.x+=(q.x-w.x)*a;w.y+=(q.y-w.y)*a;w.z+=(q.z-w.z)*base*.5}
  }
  return true;
}
function aim(rest,dir){
  const q=new T.Quaternion();
  if(rest.dot(dir)>-.96)return q.setFromUnitVectors(rest,dir);
  const ang=Math.atan2(rest.x*dir.y-rest.y*dir.x,rest.x*dir.x+rest.y*dir.y),q1=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),ang);
  return q.setFromUnitVectors(rest.clone().applyQuaternion(q1),dir).multiply(q1);
}
function applyPose(lm,world){
  const goodAt=(i,th)=>lm[i]&&lm[i].visibility>th&&lm[i].x>0&&lm[i].x<1&&lm[i].y>0&&lm[i].y<1,good=i=>goodAt(i,.62);
  const sw=stage.clientWidth,sh=stage.clientHeight,k=Math.min(sw/video.videoWidth,sh/video.videoHeight);
  const point=i=>new T.Vector3((((sw-video.videoWidth*k)/2+(front?1-lm[i].x:lm[i].x)*video.videoWidth*k)-sw/2)*2/sh,(sh/2-((sh-video.videoHeight*k)/2+lm[i].y*video.videoHeight*k))*2/sh,0);
  let xcol,ycol,origin,referenceY;const shoulderOK=good(11)&&good(12),hipOK=good(23)&&good(24);
  if(region==='lower'){
    if(!hipOK){lose('골반부터 발목까지 보이게 서 주세요.');return}
    const r=point(24),l=point(23),mid=r.clone().add(l).multiplyScalar(.5);
    xcol=l.clone().sub(r).divideScalar(.17);
    const upright=new T.Vector3(-xcol.y,xcol.x,0).normalize();if(upright.y<0)upright.negate();
    ycol=upright.multiplyScalar(xcol.length());origin=mid;referenceY=.815;
  }else{
    if(!shoulderOK){lose('양쪽 어깨가 모두 보이게 정면을 바라봐 주세요.');return}
    const r=point(12),l=point(11),mid=r.clone().add(l).multiplyScalar(.5);
    xcol=l.clone().sub(r).divideScalar(.33);
    if(hipOK){const hip=point(23).add(point(24)).multiplyScalar(.5);ycol=mid.clone().sub(hip).divideScalar(.515)}
    else{ycol=new T.Vector3(-xcol.y,xcol.x,0).normalize();if(ycol.y<0)ycol.negate();ycol.multiplyScalar(xcol.length())}
    origin=mid;referenceY=1.33;
  }
  if(xcol.length()<.15||ycol.length()<.15||Math.abs(xcol.x*ycol.y-xcol.y*ycol.x)<.03){lose('몸을 옆으로 돌리지 말고 정면을 보여 주세요.');return}
  const zscale=Math.sqrt(xcol.length()*ycol.length());const trans=origin.clone().addScaledVector(ycol,-referenceY);
  const mat=new T.Matrix4().set(xcol.x,ycol.x,0,trans.x,xcol.y,ycol.y,0,trans.y,0,0,zscale,-.07*zscale,0,0,0,1);
  if(!camSideView){root.matrix.copy(mat);root.matrixWorldNeedsUpdate=true}
  const inverse=mat.clone().invert();
  const wd=(a,b)=>Math.hypot(world[a].x-world[b].x,world[a].y-world[b].y);
  const ref=world?(region==='lower'?wd(23,24):wd(11,12)):0,upm=ref>.05?(region==='lower'?.17:.33)/ref:0;
  resetBones();let visibleCount=0;const observed=[];
  for(const side of ['R','L']){
    const ids=side==='R'?{arm:[12,14,16],leg:[24,26,28]}:{arm:[11,13,15],leg:[23,25,27]};
    for(const limb of ['arm','leg']){
      const list=ids[limb];const th=tracked&&validLimbs[side][limb]?.45:.62;
      const available=list.every(i=>goodAt(i,th));validLimbs[side][limb]=available;if(!available)continue;
      const pts=list.map(i=>point(i).applyMatrix4(inverse));
      const seg=[0,1].map(n=>{const d=pts[n+1].clone().sub(pts[n]);d.z=upm?-(world[list[n+1]].z-world[list[n]].z)*upm:0;return d});
      if(seg[0].length()<.04||seg[1].length()<.04){validLimbs[side][limb]=false;continue}
      const keys=limb==='arm'?['shoulder','elbow','wrist']:['hip','knee','ankle'];
      const a=idx[side][limb==='arm'?'arm':'thigh'],b=idx[side][limb==='arm'?'forearm':'shin'];
      let pos=pts[0].clone();pos.z=V(endpoints[side][keys[0]]).z;
      for(const [boneId,n] of [[a,0],[b,1]]){
        const rest=V(endpoints[side][keys[n+1]]).sub(V(endpoints[side][keys[n]])),dir=seg[n].clone().normalize(),sc=T.MathUtils.clamp(seg[n].length()/rest.length(),.7,1.4);
        bones[boneId].position.copy(pos);bones[boneId].quaternion.copy(aim(rest.clone().normalize(),dir));bones[boneId].scale.setScalar(sc);
        pos=pos.clone().addScaledVector(dir,rest.length()*sc);
      }
      const v=180-seg[0].clone().negate().angleTo(seg[1])*180/Math.PI;
      flex[side][limb==='arm'?'arms':'legs']=T.MathUtils.clamp(v,0,125);
      if(limb===(motion==='arms'?'arm':'leg'))observed.push(T.MathUtils.clamp(v,0,125));
      if(region==='full'||(region==='upper'&&limb==='arm')||(region==='lower'&&limb==='leg'))visibleCount++;
    }
  }
  root.visible=true;tracked=true;meshVisibility();morphUpdate();
  if(observed.length)lesson(Math.max(...observed));else{$('#angle').textContent='—';$('#bicepsState').textContent='관찰 대기';$('#tricepsState').textContent='관찰 대기'}
  status((!hipOK&&region!=='lower'?'몸통 길이 추정 중 · ':camSideView?'옆면 시점 관찰 중 · ':'정면 추적 중 · ')+`${visibleCount}개 팔다리 표시 · 노랗게 빛나는 근육이 지금 움직이는 근육이에요.`);
}
function lose(message){root.visible=false;tracked=false;$('#angle').textContent='—';$('#bicepsState').textContent='관찰 대기';$('#tricepsState').textContent='관찰 대기';status(message)}
function faceActivity(name){const max=(...keys)=>Math.max(0,...keys.map(k=>faceScores[k]||0));if(name==='frontalis')return max('browInnerUp','browOuterUpLeft','browOuterUpRight');if(name==='orbicularis oculi')return max('eyeBlinkLeft','eyeBlinkRight');if(name==='zygomaticus major')return max('mouthSmileLeft','mouthSmileRight');if(name==='orbicularis oris')return max('mouthPucker','mouthFunnel');return 0}
function applyFace(lm){
  if(![10,152,234,454].every(i=>lm[i]&&Number.isFinite(lm[i].x)&&Number.isFinite(lm[i].y))){lose('얼굴 전체가 화면에 보이게 해 주세요.');return}
  const sw=stage.clientWidth,sh=stage.clientHeight,k=Math.min(sw/video.videoWidth,sh/video.videoHeight),w=video.videoWidth*k,h=video.videoHeight*k;
  const point=i=>new T.Vector3(((front?1-lm[i].x:lm[i].x)-.5)*w*2/sh,(.5-lm[i].y)*h*2/sh,-(lm[i].z||0)*w*2/sh);
  const x=point(454).sub(point(234)).divideScalar(.14),y=point(10).sub(point(152)).divideScalar(.17);
  if(x.length()<.3||y.length()<.3){lose('얼굴을 조금 더 가까이 보여 주세요.');return}
  y.normalize().multiplyScalar(T.MathUtils.clamp(point(10).distanceTo(point(152))/.17,x.length()*.65,x.length()*1.5));
  const z=new T.Vector3().crossVectors(x,y).normalize();if(z.z<0)z.negate();z.multiplyScalar(Math.sqrt(x.length()*y.length()));
  const center=point(10).add(point(152)).multiplyScalar(.5);const t=center.addScaledVector(y,-1.525).addScaledVector(z,-.14);
  root.matrix.makeBasis(x,y,z).setPosition(t);root.matrixWorldNeedsUpdate=true;root.visible=true;tracked=true;resetBones();meshVisibility();
  status('얼굴 추적 중 · 표정과 관련된 얼굴 근육을 강조해요.');
}
function updateRenderCount(){
  const entries=activeParts(),muscles=entries.filter(p=>p.tissue==='muscle').length;
  $('#renderCount').textContent=`${entries.length}개 부위 로딩 · 근육 ${muscles}묶음`;
  $('#quality').textContent=organGuard?'뼈가 지킴이 · 기관 보호 보기':detail?`상세 근육 · ${entries.length}개 부위`:'교과서 10개 부위';
}
function buildZones(){
  for(const [id,label]of Object.entries(ZONES)){
    const wrap=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');
    input.type='checkbox';input.checked=true;input.dataset.zone=id;
    input.onchange=()=>{if(input.checked)enabledZones.add(id);else enabledZones.delete(id);loadRegion(region)};
    text.textContent=label;wrap.append(input);wrap.append(text);$('#zones').append(wrap);
  }
}

// ── 단일 입구 & 활동 전환 ──
function setActivity(next,{openGuide=false}={}){
  activity=next;
  $('#homeHub').hidden=true;
  document.body?.classList?.remove('activity-observe','activity-motion','activity-camera');
  document.body?.classList?.add('activity-'+next);
  $('#tabObserve').classList.toggle('active',next==='observe');
  $('#tabMotion').classList.toggle('active',next==='motion');
  $('#tabCamera').classList.toggle('active',next==='camera');
  $('#tabObserve').setAttribute('aria-selected',next==='observe');
  $('#tabMotion').setAttribute('aria-selected',next==='motion');
  $('#tabCamera').setAttribute('aria-selected',next==='camera');
  if(next==='observe'){
    $('#activityOverline').textContent='1차시 · 뼈와 근육 관찰';
    $('#activityTitle').textContent='우리 몸의 뼈와 근육을 살펴볼까요?';
    if(mode==='camera')stop();
  }else if(next==='motion'){
    $('#activityOverline').textContent='2차시 · 팔·다리 움직임과 근육 길이';
    $('#activityTitle').textContent='팔·다리를 움직이면 근육은 어떻게 변할까요?';
    if(mode==='camera')stop();
    if(organGuard){organGuard=false;applyVisibility();buildLabels()}
    if(angle===0)updateDemo(85);
    setView('side');
  }else if(next==='camera'){
    $('#activityOverline').textContent='카메라 · 내 모습에 겹쳐 보기';
    $('#activityTitle').textContent='내 몸의 뼈와 근육을 움직여 볼까요?';
    if(openGuide)$('#cameraGuide').hidden=false;
  }
  if(root)morphUpdate();
  resize();
}
async function toggleOrganGuard(){
  organGuard=!organGuard;
  if(organGuard){
    if(region==='lower'){await loadRegion('full');return}
    await ensureOrgans();
    setView('front');
    $('#organBanner').textContent='🛡️ 뼈가 뇌를 감싸 보호해요 · 갈비뼈가 심장과 폐를 보호해요.';
    status('뼈가 지킴이 켜짐 · 머리뼈 속 뇌와 갈비뼈 속 심장·폐가 보호되는 모습을 관찰해요.');
  }else{
    status('뼈가 지킴이를 껐어요.');
  }
  applyVisibility();buildLabels();updateRenderCount();
}
function resetAll(){
  playing=false;$('#play').textContent='▶ 자동 움직임';
  if(mode==='camera')stop();
  organGuard=false;layer='both';angle=0;
  $('#opacity').value='85';$('#isolate').checked=false;
  if(bones.length)updateDemo(0);
  setView('front');
  applyVisibility();buildLabels();updateRenderCount();
  status('화면과 움직임을 모두 처음 상태로 되돌렸어요.');
}

// ── 접근성: 글자 크기 & 한국어 음성 읽기 ──
function toggleFont(){
  const on=document.body?.classList?.toggle('large-text');
  $('#fontToggle').textContent=on?'가 보통':'가+ 크게';
  $('#fontToggle').setAttribute('aria-pressed',!!on);
}
function toggleSpeak(){
  const synth=globalThis.speechSynthesis;
  if(!synth||typeof SpeechSynthesisUtterance==='undefined'){
    status('이 브라우저에서는 소리 읽어주기를 지원하지 않아요.');
    return;
  }
  if(speaking){
    synth.cancel();speaking=false;
    $('#speakBtn').textContent='🔊 읽어주기';$('#speakBtn').setAttribute('aria-pressed','false');
    return;
  }
  synth.cancel();
  let text='';
  if(organGuard){
    text=$('#organBanner').textContent.replace('🛡️','').trim()+' 뼈는 우리 몸의 모양을 만들고, 몸을 지탱하며, 뇌와 심장, 폐 같은 기관을 보호해요.';
  }else if(activity==='motion'){
    text=$('#motionLesson').textContent+` 현재 각도는 ${$('#angle').textContent}도예요. 편 때 100과 비교한 길이는 ${$('#frontNowLen').textContent}입니다.`;
  }else{
    text=$('#partInfo').textContent||'뼈와 근육을 선택해 보세요.';
  }
  const u=new SpeechSynthesisUtterance(text);
  u.lang='ko-KR';u.rate=.95;
  u.onend=u.onerror=()=>{speaking=false;$('#speakBtn').textContent='🔊 읽어주기';$('#speakBtn').setAttribute('aria-pressed','false')};
  speaking=true;$('#speakBtn').textContent='⏹ 멈추기';$('#speakBtn').setAttribute('aria-pressed','true');
  synth.speak(u);
}

// ── 오프라인 서비스 워커 등록 ──
function registerOffline(){
  const sw=navigator?.serviceWorker;
  if(!sw?.register){$('#offlineStatus').textContent='온라인 모드';return}
  sw.register('./sw.js').then(()=>{
    $('#offlineStatus').textContent='오프라인에서도 열려요 ✓';
    $('#offlineStatus').classList.add('ready');
  }).catch(()=>{$('#offlineStatus').textContent='오프라인 저장 대기 중'});
  sw.addEventListener?.('message',e=>{
    if(e.data?.type==='SW_CACHE_DONE'){
      $('#offlineStatus').textContent='오프라인에서도 열려요 ✓';
      $('#offlineStatus').classList.add('ready');
    }else if(e.data?.type==='SW_CACHE_PROGRESS'){
      $('#offlineStatus').textContent=`오프라인 저장 중 (${e.data.done}/${e.data.total})`;
    }
  });
}

// ── 이벤트 바인딩 ──
buildZones();
$('#detailLevel').onchange=e=>{detail=e.target.value==='all';loadRegion(region)};
$('#isolate').onchange=()=>{applyVisibility();buildLabels()};
$('#partSearch').oninput=buildParts;
$('#renderQuality').onchange=e=>{renderer.setPixelRatio(Math.min(devicePixelRatio,e.target.value==='sharp'?2:1));resize()};

let pointerStart=null;
function pick(e){
  if(!loaded||(mode!=='model'&&!frozen)||!pointerStart||Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])>6)return;
  const box=renderer.domElement.getBoundingClientRect(),p=new T.Vector2((e.clientX-box.left)/box.width*2-1,1-(e.clientY-box.top)/box.height*2),ray=new T.Raycaster();
  ray.setFromCamera(p,camera);
  const targets=[...organObjects.filter(o=>o.mesh.visible),...objects.filter(o=>o.mesh.visible)];
  targets.forEach(o=>o.mesh.computeBoundingSphere());
  const hit=ray.intersectObjects(targets.map(o=>o.mesh))[0];
  if(hit)select(hit.object.name);
}

$('#homeBtn').onclick=()=>{$('#homeHub').hidden=false};
$('#cardObserve').onclick=()=>setActivity('observe');
$('#cardMotion').onclick=()=>setActivity('motion');
$('#cardCamera').onclick=()=>setActivity('camera',{openGuide:true});
$('#tabObserve').onclick=()=>setActivity('observe');
$('#tabMotion').onclick=()=>setActivity('motion');
$('#tabCamera').onclick=()=>setActivity('camera',{openGuide:mode!=='camera'});

for(const id of ['camPresetArm','camPresetUpper','camPresetFull']){
  $('#'+id).onclick=()=>{
    camPreset=$('#'+id).dataset.campreset;
    for(const k of ['camPresetArm','camPresetUpper','camPresetFull'])$('#'+k).classList.toggle('active',k===id);
  };
}
$('#closeCameraGuide').onclick=()=>{$('#cameraGuide').hidden=true};
$('#startCameraNow').onclick=async()=>{
  $('#cameraGuide').hidden=true;
  const targetRegion=camPreset==='full'?'full':'upper';
  if(region!==targetRegion)await loadRegion(targetRegion);
  await start();
};

$('#modelMode').onclick=()=>{stop();status('3D 모형 관찰로 돌아왔어요. 카메라는 꺼졌어요.')};
$('#cameraMode').onclick=()=>{if(mode==='camera')return;setActivity('camera',{openGuide:true})};
$('#flip').onclick=()=>{front=!front;start()};
$('#stopCamera').onclick=()=>$('#modelMode').click();
$('#freezeBtn').onclick=toggleFreeze;
$('#sideViewCamBtn').onclick=toggleCameraSideView;
$('#savePngBtn').onclick=saveModelPng;
$('#organGuardBtn').onclick=toggleOrganGuard;
$('#zoomIn').onclick=()=>zoomBy(.82);
$('#zoomOut').onclick=()=>zoomBy(1.22);
$('#quickResetBtn').onclick=resetAll;
$('#fontToggle').onclick=toggleFont;
$('#speakBtn').onclick=toggleSpeak;
$('#sourceLink').onclick=()=>{$('#sourceDetails').open=true};

$('#bend').oninput=e=>{playing=false;$('#play').textContent='▶ 자동 움직임';updateDemo(+e.target.value)};
$('#play').onclick=()=>{playing=!playing;$('#play').textContent=playing?'Ⅱ 움직임 멈추기':'▶ 자동 움직임'};
document.querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>loadRegion(b.dataset.region));
document.querySelectorAll('[data-layer]').forEach(b=>b.onclick=()=>{organGuard=false;layer=b.dataset.layer;applyVisibility();buildLabels();updateRenderCount()});
document.querySelectorAll('[data-motion]').forEach(b=>b.onclick=async()=>{
  const m=b.dataset.motion;
  if(m==='legs'&&region==='upper'){motion='legs';await loadRegion('full');setMotion('legs');updateDemo(angle||85);setView('side');return}
  setMotion(m);
});
$('#opacity').oninput=applyVisibility;
$('#names').onchange=labelsUpdate;
$('#reset').onclick=resetAll;
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('#fullscreen').onclick=async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#viewport').requestFullscreen()}
  catch{status('이 브라우저에서는 전체 화면을 지원하지 않아요.')}
};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&stream){stop();status('화면을 벗어나 카메라를 껐어요.')}});
window.addEventListener('pagehide',()=>stream?.getTracks().forEach(t=>t.stop()));

let lastFrame=0;
function animate(t){
  requestAnimationFrame(animate);
  if(document.hidden||t-lastFrame<32)return;
  const dt=lastFrame?Math.min(t-lastFrame,250):32;lastFrame=t;
  if(playing&&mode==='model')updateDemo((1-Math.cos(t/1700))*62.5);
  if(mode==='camera'&&!frozen){
    detect(t);
    if(smoothStep(dt)&&smLm){if(region==='head')applyFace(smLm);else applyPose(smLm,smWorld)}
  }
  updateWork(dt);
  if(loaded){objects.forEach(tint);labelsUpdate()}
  controls.update();
  renderer.render(scene,activeCamera());
}
window.__bodyDebug=()=>({valid:JSON.parse(JSON.stringify(validLimbs)),mode,activity,frozen,camSideView,organGuard,flex:JSON.parse(JSON.stringify(flex)),work:JSON.parse(JSON.stringify(work)),detectGap:Math.round(detectGap)});

try{
  init();
  registerOffline();
  // URL 쿼리(?activity=observe|motion|camera)로 바로 진입 가능
  const params=globalThis.location?.search?new URLSearchParams(globalThis.location.search):null;
  const initAct=params?.get('activity');
  if(initAct&&['observe','motion','camera'].includes(initAct))setActivity(initAct,{openGuide:initAct==='camera'});
  loadRegion('upper');
  requestAnimationFrame(animate);
}catch(e){
  $('#loadingText').textContent='3D 화면을 시작하지 못했어요. WebGL을 지원하는 브라우저에서 열어 주세요.';
  status('3D 초기화 실패: '+e.message);console.error(e);
}
