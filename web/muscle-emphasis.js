// Classroom-only visual emphasis. Tendon endpoints stay anchored (envelope = 0).
export function teachingMuscleVertex(x,y,z,cx,center,cz,envelope,shortness){
  const e=Math.max(0,Math.min(1,envelope)),s=Math.max(0,Math.min(1,shortness));
  const width=.72+1.18*s,depth=.72+1.38*s,length=1.10-.50*s;
  return [cx+(x-cx)*(1+(width-1)*e),center+(y-center)*(1+(length-1)*e),cz+(z-cz)*(1+(depth-1)*e)];
}
export function teachingMorphWeights(flex,enabled){
  const f=Math.max(0,Math.min(1,flex/125));
  return enabled?[0,1-f,f]:[f,0,0];
}
