/* Grounded walking model. Contact support is an intentional game assist. */
(function(root){
'use strict';
const {Engine,Bodies,Body,Composite,Constraint}=Matter;
const DT=1000/60,FLOOR=410,START=240;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
function point(b,x,y){return{x:b.position.x+Math.cos(b.angle)*x-Math.sin(b.angle)*y,y:b.position.y+Math.sin(b.angle)*x+Math.cos(b.angle)*y}}
class Walker{
 constructor(mode='practice'){this.mode=mode;this.engine=Engine.create({positionIterations:12,velocityIterations:10,constraintIterations:6});this.engine.gravity.y=.85;this.time=0;this.distance=0;this.ended=false;this.reason='';this.stable=true;this.restFrames=0;this.steps=0;this.lastLanding=-1;this.legs=[];
 const opts={collisionFilter:{group:-1},density:.002,friction:.9,frictionStatic:2,restitution:0,frictionAir:.025};
 this.torso=Bodies.rectangle(START,210,34,88,{...opts,density:.003});
 Composite.add(this.engine.world,[Bodies.rectangle(0,FLOOR+35,200000,70,{isStatic:true,friction:1,frictionStatic:3}),this.torso]);
 for(let i=0;i<2;i++){
 const x=START+(i?12:-12),thigh=Bodies.rectangle(x,294,20,80,opts),shin=Bodies.rectangle(x,369,16,70,opts),foot=Bodies.rectangle(x+9,403,48,14,opts);
 Composite.add(this.engine.world,[thigh,shin,foot]);this.joint(this.torso,thigh,{x:i?12:-12,y:44},{x:0,y:-40});this.joint(thigh,shin,{x:0,y:40},{x:0,y:-35});this.joint(shin,foot,{x:0,y:35},{x:-9,y:0});
 this.legs.push({thigh,shin,foot,planted:true,anchored:true,wasAir:false});
 }
 // Start with the sole exactly on the track; the supported pose does not drift.
 this.all=[this.torso,...this.legs.flatMap(l=>[l.thigh,l.shin,l.foot])];this.hold();
 }
 joint(a,b,pa,pb){Composite.add(this.engine.world,Constraint.create({bodyA:a,bodyB:b,pointA:pa,pointB:pb,length:0,stiffness:1,damping:.2}))}
 contact(l){const heel=point(l.foot,-21,7),toe=point(l.foot,21,7);return {heel:Math.abs(heel.y-FLOOR)<5,toe:Math.abs(toe.y-FLOOR)<5,flat:Math.abs(angle(l.foot.angle))<.16&&Math.abs(heel.y-FLOOR)<5&&Math.abs(toe.y-FLOOR)<5}}
 hold(){this.stable=true;for(const b of this.all){Body.setVelocity(b,{x:0,y:0});Body.setAngularVelocity(b,0);if(!b.isStatic)Body.setStatic(b,true)}}
 release(){this.stable=false;for(const b of [this.torso,...this.legs.flatMap(l=>[l.thigh,l.shin])])Body.setStatic(b,false)}
 motor(a,b,target,gain=.0004,cap=5){const error=angle(b.angle-a.angle-target),v=b.angularVelocity-a.angularVelocity,t=clamp((-error*gain-v*.004)*b.inertia,-cap,cap);b.torque+=t;a.torque-=t}
 tick(keys){if(this.ended)return;this.time+=1/60;const input=keys.size>0;if(input&&this.stable)this.release();
 if(!this.stable){
 const contacts=this.legs.map(l=>this.contact(l));
 for(let i=0;i<2;i++){
 const l=this.legs[i],lift=keys.has(i?'o':'q'),bend=keys.has(i?'p':'w');
 if((lift||bend)&&l.anchored){Body.setStatic(l.foot,false);l.anchored=false;}
 if(l.anchored){l.foot.torque=0;} 
 this.motor(this.torso,l.thigh,lift?-.65:.22);
 this.motor(l.thigh,l.shin,bend?(this.mode==='practice'?.8:1.1):(lift&&this.mode==='practice'?.55:.025),.00065,6);
 const f=l.foot;if(!l.anchored)f.torque+=clamp((-angle(f.angle)*.0015-f.angularVelocity*.012)*f.inertia,-8,8);
 if(contacts[i].flat&&!lift&&!bend){Body.setVelocity(f,{x:f.velocity.x*.7,y:Math.min(0,f.velocity.y)});}
 if(!contacts[i].heel&&!contacts[i].toe&&f.position.y<FLOOR-18)l.wasAir=true;
 if(contacts[i].flat&&l.wasAir){if(this.lastLanding!==i){this.steps++;this.lastLanding=i}l.wasAir=false;}
 l.planted=contacts[i].flat;
 }
 const any=contacts.some(c=>c.flat),both=contacts.every(c=>c.flat),gain=any?(this.mode==='practice'?.0012:.00065):.00025;
 this.torso.torque+=clamp((-angle(this.torso.angle)*gain-this.torso.angularVelocity*.008)*this.torso.inertia,-8,8);
 // A support spring acts only while a complete sole touches the ground.
 if(any){const feet=this.legs.filter((l,i)=>contacts[i].flat);const center=feet.reduce((s,l)=>s+l.foot.position.x-9,0)/feet.length;
 const strength=this.mode==='practice'?1:.65;
 Body.applyForce(this.torso,this.torso.position,{x:clamp((center-this.torso.position.x)*.00003-this.torso.velocity.x*.0004,-.035,.035)*strength,y:clamp((210-this.torso.position.y)*.00065-this.torso.velocity.y*.002,-.12,.015)*strength});
 }
 for(const b of this.all)if(!b.isStatic)Body.setAngularVelocity(b,clamp(b.angularVelocity,-.12,.12));
 Engine.update(this.engine,DT);
 // Joint stops prevent knees reversing and ankles spinning through a full turn.
 for(const l of this.legs){for(const [parent,child,lo,hi,up] of [[this.torso,l.thigh,-.85,.6,-40],[l.thigh,l.shin,-.03,1.65,-35]]){const a=angle(child.angle-parent.angle),limited=clamp(a,lo,hi);if(a!==limited){Body.rotate(child,limited-a,point(child,0,up));Body.setAngularVelocity(child,parent.angularVelocity);}}if(!l.foot.isStatic){const a=angle(l.foot.angle),limited=clamp(a,-.4,.4);if(a!==limited){Body.rotate(l.foot,limited-a,point(l.foot,-9,0));Body.setAngularVelocity(l.foot,0);}}}

 for(let i=0;i<2;i++){const l=this.legs[i],f=l.foot,command=keys.has(i?'o':'q')||keys.has(i?'p':'w');
 if(!l.anchored&&!command&&Math.abs(angle(f.angle))<.35&&f.position.y>FLOOR-17&&Math.abs(f.velocity.y)<4){Body.setAngle(f,0);Body.setPosition(f,{x:f.position.x,y:FLOOR-7});Body.setStatic(f,true);l.anchored=true;}
 }
 const after=this.legs.map(l=>this.contact(l));
 this.legs.forEach((l,i)=>l.planted=after[i].flat);
 const supportMin=Math.min(...this.legs.map(l=>l.foot.position.x))-27,supportMax=Math.max(...this.legs.map(l=>l.foot.position.x))+27;
 const centered=this.torso.position.x>=supportMin&&this.torso.position.x<=supportMax;
 if(!input&&after.every(c=>c.flat)&&centered&&Math.abs(angle(this.torso.angle))<.45){this.restFrames++;if(this.restFrames>=5)this.hold()}else this.restFrames=0;
 this.distance=Math.max(this.distance,(this.torso.position.x-START)/100);
 if(this.torso.position.y>FLOOR-60||Math.abs(angle(this.torso.angle))>1.6){this.ended=true;this.reason='넘어졌어요';}
 }
 if(this.time>=60-1e-6){this.ended=true;this.reason='60초 완주';}
 }
}
root.WalkPhysics={Walker,point,angle,clamp,FLOOR,START};
})(typeof window!=='undefined'?window:globalThis);
