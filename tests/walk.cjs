const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../web'),ctx=vm.createContext({console,devicePixelRatio:1});
for(const f of ['vendor/matter.min.js','walk-physics.js','walk-render.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
vm.runInContext(`
for(const mode of ['practice','challenge']){
 const w=new WalkPhysics.Walker(mode);for(let t=0;t<3600;t++)w.tick(new Set());
 if(!w.stable||w.distance!==0||w.torso.position.y!==210||!w.ended)throw Error('Idle stance drifted');
 if(!w.legs.every(l=>w.contact(l).flat))throw Error('Soles not planted');
 const recover=new WalkPhysics.Walker(mode);for(let t=0;t<600;t++){recover.tick(new Set(t<25?['q']:[]));}
 if(!recover.stable||recover.ended||!recover.legs.every(l=>recover.contact(l).flat))throw Error('Released foot did not recover');
 recover.tick(new Set(['o']));if(recover.stable||recover.legs[1].foot.isStatic)throw Error('Foot did not release on input');
}
const progress=new WalkPhysics.Walker();for(let t=0;t<1800&&!progress.ended;t++){const phase=t%75,side=Math.floor(t/75)%2;progress.tick(new Set(phase<60?[side?'o':'q']:[]));}
if(progress.distance<2||progress.ended)throw Error('Beginner rhythm is not playable');
for(const b of progress.all)if(!Number.isFinite(b.position.x)||!Number.isFinite(b.position.y))throw Error('Physics diverged');
const posed=new WalkPhysics.Walker(),before=WalkArt.pose(posed,posed.legs[0]);posed.legs[0].shin.angle=1.4;const after=WalkArt.pose(posed,posed.legs[0]);if(after.knee<=before.knee)throw Error('Muscles not pose driven');
const fake=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
for(const [width,height] of [[900,460],[390,390]]){const canvas={width:0,height:0,getContext:()=>fake,getBoundingClientRect:()=>({width,height})};const renderer=new WalkArt.WalkIllustration(canvas);renderer.draw(new WalkPhysics.Walker());renderer.bones=true;renderer.draw(progress);}
console.log('PASS: 60-second stance, sole contact, landing recovery, foot release, forward progress, muscle response, desktop/mobile render paths');
`,ctx);
