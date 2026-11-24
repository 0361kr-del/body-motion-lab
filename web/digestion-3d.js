import * as T from 'three';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {DRACOLoader} from './vendor/DRACOLoader.js';
import {OrbitControls} from './vendor/OrbitControls.js';
const COLORS={esophagus:0xf5a790,stomach:0xff829a,small:0xffb17d,large:0xd8a3e8,liver:0x9e6f4c,pancreas:0xf0cb76,gallbladder:0x94c09c};
export async function createViewer(host,onPick){
 const status=host.querySelector('#threeStatus'),scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,.01,20),renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;host.prepend(renderer.domElement);
 scene.add(new T.HemisphereLight(0xd9f7ff,0x394658,2));const sun=new T.DirectionalLight(0xffe9d2,3);sun.position.set(1,2,3);scene.add(sun);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.35;controls.maxDistance=3;
 const reset=()=>{controls.target.set(0,1.18,.08);camera.position.set(0,1.2,1.65);controls.update()};reset();
 const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};const observer=new ResizeObserver(resize);observer.observe(host);resize();
 const draco=new DRACOLoader().setDecoderPath('./vendor/').setWorkerLimit(1),loader=new GLTFLoader().setDRACOLoader(draco),meshes=[],context=[],helpers=new Set(['liver','pancreas','gallbladder']);let selected='mouth',showHelpers=false,active=true;
 function materialize(gltf,id,bone=false,mirror=false){gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone();geo.applyMatrix4(o.matrixWorld);geo.computeVertexNormals();const mat=new T.MeshStandardMaterial({color:bone?0x8badbf:COLORS[id],roughness:.6,transparent:bone||helpers.has(id),opacity:bone?.12:helpers.has(id)?.55:1,depthWrite:!bone&&!helpers.has(id),side:T.DoubleSide});const mesh=new T.Mesh(geo,mat);mesh.userData.id=id;mesh.visible=!helpers.has(id);scene.add(mesh);(bone?context:meshes).push(mesh);if(mirror){const other=mesh.clone();other.scale.x=-1;scene.add(other);context.push(other)}o.geometry.dispose();o.material.dispose()})}
 try{for(const [i,id] of Object.keys(COLORS).entries()){status.textContent=`해부학 모형 불러오는 중 · ${i+1} / 7`;materialize(await loader.loadAsync(`./models/digestive/${id}.glb`),id)}for(const id of ['skull','ribs','pelvis']){materialize(await loader.loadAsync(`./models/body/${id}.glb`),id,true,id!=='skull')}}catch(e){observer.disconnect();controls.dispose();renderer.dispose();renderer.domElement.remove();for(const m of [...meshes,...context]){m.geometry.dispose();m.material.dispose()}throw e}finally{draco.dispose()}
 function highlight(){for(const m of meshes){m.material.emissive.setHex(m.userData.id===selected?0x754123:0);m.material.emissiveIntensity=.6;m.visible=!helpers.has(m.userData.id)||showHelpers}}
 function setStage(id){selected=id;status.textContent=['mouth','anus'].includes(id)?'입과 항문의 이동 과정은 ‘소화 경로’에서 관찰해요.':'강조된 기관을 돌려 보세요 · 과정은 오른쪽 확대 모형에 표시돼요.';highlight()}
 let down=null;renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const r=renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);const h=ray.intersectObjects(meshes.filter(m=>m.visible&&!helpers.has(m.userData.id)))[0];if(h)onPick(h.object.userData.id)});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();active=false;status.textContent='3D 표시가 중단됐어요. 소화 경로 화면은 계속 이용할 수 있어요.'});
 setStage(selected);return {setStage,reset,setContext(on){context.forEach(m=>m.visible=on)},setHelpers(on){showHelpers=on;highlight()},selectHelper(id){selected=id;highlight()},render(visible){if(!visible||!active)return;controls.update();renderer.render(scene,camera)}};
}
