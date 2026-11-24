/* Original canvas illustration: articulated athlete, anatomy cutaways and running track. */
(function(root){
'use strict';
const {point,angle,clamp,FLOOR,START}=WalkPhysics;
function pose(w,l){return {hip:clamp((.22-angle(l.thigh.angle-w.torso.angle))/.87,0,1),knee:clamp(angle(l.shin.angle-l.thigh.angle)/1.65,0,1)}}
class WalkIllustration{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.bones=false;this.camera=null;}
 path(points,fill,stroke,width=1){const c=this.ctx;c.beginPath();for(const [cmd,...a] of points)c[cmd](...a);if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke()}}
 line(a,b,color,width){const c=this.ctx;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke()}
 ellipse(x,y,rx,ry,color){const c=this.ctx;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=color;c.fill()}
 gradient(a,b){const g=this.ctx.createLinearGradient(-25,0,25,0);g.addColorStop(0,a);g.addColorStop(.56,b);g.addColorStop(1,a);return g}
 belly(x,y,len,width,shortness,color){const c=this.ctx,half=len*(1-.27*shortness)/2,w=width*(1+.42*shortness);c.save();c.translate(x,y);
 this.line({x:0,y:-len/2-6},{x:0,y:len/2+6},'#eee0c9',2.4);
 c.beginPath();c.moveTo(0,-half);c.bezierCurveTo(w,-half*.7,w,half*.55,0,half);c.bezierCurveTo(-w,half*.55,-w,-half*.7,0,-half);c.fillStyle=this.gradient(color,color==='#c66f5b'?'#f6b99b':'#c6b2ce');c.fill();c.strokeStyle=color;c.lineWidth=.7;c.stroke();
 c.strokeStyle=color+'aa';c.lineWidth=.65;for(let n=-2;n<=2;n++){c.beginPath();c.moveTo(0,-half*.9);c.bezierCurveTo(n*w*.5,-half*.3,n*w*.5,half*.3,0,half*.9);c.stroke()}c.restore();}
 limb(body,len,top,bottom,isThigh,m,far,bones){const c=this.ctx;c.save();c.translate(body.position.x,body.position.y);c.rotate(body.angle);
 const h=len/2;c.beginPath();c.moveTo(-top,-h);c.bezierCurveTo(-top*1.4,-h*.3,-bottom*1.3,h*.55,-bottom,h);c.quadraticCurveTo(0,h+7,bottom,h);c.bezierCurveTo(bottom*1.2,h*.4,top*1.5,-h*.5,top,-h);c.quadraticCurveTo(0,-h-8,-top,-h);c.closePath();
 c.fillStyle=this.gradient(far?'#bd9a87':'#d7b199',far?'#dcc1ac':'#f0d6b9');c.fill();c.strokeStyle=far?'#af927d':'#b99075';c.lineWidth=.8;c.stroke();c.save();c.clip();
 if(isThigh){this.belly(9,1,len*.87,12,1-m.knee,'#c66f5b');this.belly(-9,-1,len*.87,10,m.knee,'#8d759f');this.belly(2,-len*.2,len*.54,5,1-m.knee,'#c66f5b');}
 else{this.belly(-5,-9,len*.68,9,.2,'#bc8b80');this.belly(6,0,len*.82,4,.1,'#c49c86');}
 if(bones){this.line({x:0,y:-h},{x:0,y:h},'#fff1d3',5);this.ellipse(0,-h,5,5,'#fff1d3');this.ellipse(0,h,5,5,'#fff1d3');}
 c.restore();c.restore();}
 shoe(l,i){const c=this.ctx;c.save();c.translate(l.foot.position.x,l.foot.position.y);c.rotate(l.foot.angle);
 this.path([['moveTo',-23,5],['lineTo',-23,-7],['quadraticCurveTo',-22,-15,-15,-16],['lineTo',-5,-14],['quadraticCurveTo',4,-5,17,-5],['quadraticCurveTo',26,-5,25,5],['closePath']],i?'#b47b5d':'#47725c','#3f5044',.9);
 this.path([['moveTo',-24,4],['lineTo',25,4],['lineTo',26,8],['lineTo',-24,8],['closePath']],'#f3ecd5','#c3bca7',.6);
 for(let x=-5;x<9;x+=5)this.line({x,y:-9+(x+5)*.18},{x:x+5,y:-6+(x+5)*.18},'#ece8d6',1.3);
 this.line({x:-20,y:-6},{x:-12,y:-6},i?'#edc497':'#dbea9d',3);c.restore();}
 arm(shoulder,hipAngle,far){const c=this.ctx,upper=40,lower=35,a=.12-hipAngle*.7,elbow={x:shoulder.x+Math.sin(a)*upper,y:shoulder.y+Math.cos(a)*upper},hand={x:elbow.x+25,y:elbow.y+lower*.65};this.line(shoulder,elbow,far?'#cba58a':'#ecc5a7',14);this.line(elbow,hand,far?'#c49c81':'#e9c2a1',11);this.ellipse(hand.x,hand.y,6,8,far?'#c49c81':'#ecc5a7');this.line(shoulder,{x:shoulder.x+(elbow.x-shoulder.x)*.42,y:shoulder.y+(elbow.y-shoulder.y)*.42},far?'#395e50':'#517e66',18);}
 torso(w){const c=this.ctx,b=w.torso;c.save();c.translate(b.position.x,b.position.y);c.rotate(b.angle);
 // Neck, complete athletic torso, waist and shorts form one continuous silhouette.
 this.path([['moveTo',-10,-48],['lineTo',-8,-61],['lineTo',8,-61],['lineTo',12,-45],['closePath']],'#dcb396');
 this.path([['moveTo',-11,-48],['quadraticCurveTo',-24,-48,-27,-35],['quadraticCurveTo',-25,-5,-18,19],['lineTo',-23,37],['quadraticCurveTo',0,48,23,37],['lineTo',18,19],['quadraticCurveTo',29,-14,25,-35],['quadraticCurveTo',22,-47,11,-48],['quadraticCurveTo',0,-37,-11,-48],['closePath']],this.gradient('#315e4c','#638b6b'),'#345c4b',1);
 this.path([['moveTo',-18,-30],['quadraticCurveTo',-10,-7,-11,22],['lineTo',-15,31]],null,'#b6d391',3);
 this.path([['moveTo',18,-30],['quadraticCurveTo',9,-4,12,24]],null,'#254d41',2);
 c.fillStyle='#edf1ce';c.font='bold 13px system-ui';c.fillText('06',-8,-12);c.font='5px system-ui';c.fillText('MOTION',-10,-25);
 this.path([['moveTo',-21,26],['quadraticCurveTo',0,31,21,26],['lineTo',27,49],['lineTo',6,56],['lineTo',0,42],['lineTo',-4,56],['lineTo',-26,49],['closePath']],'#314e43','#213e36',1);
 this.line({x:-20,y:29},{x:20,y:29},'#b7cb8a',2);
 if(this.bones){c.globalAlpha=.45;this.line({x:0,y:-35},{x:0,y:30},'#fff1d3',4);for(let y=-26;y<7;y+=7){this.path([['moveTo',-17,y],['quadraticCurveTo',0,y+9,17,y]],null,'#fff1d3',2)}c.globalAlpha=1;}
 c.restore();
 const head=point(b,2,-76);c.save();c.translate(head.x,head.y);c.rotate(b.angle*.5);
 this.path([['moveTo',-15,-15],['quadraticCurveTo',4,-24,17,-10],['lineTo',18,-1],['lineTo',23,5],['lineTo',18,8],['quadraticCurveTo',19,24,7,24],['quadraticCurveTo',-12,23,-17,5],['closePath']],this.gradient('#d5aa8d','#f2ceb0'),'#bd957c',.6);
 this.path([['moveTo',-17,5],['quadraticCurveTo',-24,-13,-10,-23],['quadraticCurveTo',6,-29,18,-17],['lineTo',19,-10],['quadraticCurveTo',4,-11,-5,-16],['lineTo',-10,-2],['lineTo',-13,7],['closePath']],'#394c43');
 this.ellipse(-12,5,4,6,'#e9bea0');this.ellipse(13,-1,1.4,1.8,'#334a40');this.line({x:13,y:15},{x:18,y:13},'#a2765d',1);c.restore();}
 draw(w){const c=this.ctx,r=this.canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);if(this.canvas.width!==Math.round(r.width*d)||this.canvas.height!==Math.round(r.height*d)){this.canvas.width=Math.round(r.width*d);this.canvas.height=Math.round(r.height*d)}c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,r.width,r.height);
 const zoom=r.height/480,width=r.width/zoom,height=480,cam=w.torso.position.x-width*(r.width<500?.32:.4);c.scale(zoom,zoom);
 const bg=c.createLinearGradient(0,0,0,410);bg.addColorStop(0,'#e9f0e3');bg.addColorStop(1,'#f7f4e6');c.fillStyle=bg;c.fillRect(0,0,width,height);
 this.ellipse(width*.75,98,43,43,'#f7e8bd');
 // Distant stadium, trees, and track markings move more slowly than the runner.
 const parallax=cam*.14;
 c.fillStyle='#d7e1d0';for(let x=-80-(parallax%130);x<width+100;x+=130){this.ellipse(x,265,70,75,'#d7e1d0');this.ellipse(x+45,285,60,60,'#dce4d4')}
 c.fillStyle='#e5e8d9';c.fillRect(0,314,width,59);for(let y=323;y<372;y+=12)this.line({x:0,y},{x:width,y},'#ced8c6',1);
 c.fillStyle='#d2dcb8';c.fillRect(0,365,width,45);c.fillStyle='#c0ce9e';c.fillRect(0,402,width,8);
 const track=c.createLinearGradient(0,410,0,480);track.addColorStop(0,'#d5a286');track.addColorStop(1,'#dfb59a');c.fillStyle=track;c.fillRect(0,410,width,70);this.line({x:0,y:411},{x:width,y:411},'#f7dfbf',2);this.line({x:0,y:451},{x:width,y:451},'#f3d5b7',2);
 c.save();c.translate(-cam,0);
 const first=Math.floor((cam-START)/100);for(let n=first;n<(cam+width-START)/100+1;n++){const x=START+n*100;this.line({x,y:413},{x:x-8,y:429},'#f6e1c4',1.4);if(n>=0){c.fillStyle='#8a6551';c.font='9px system-ui';c.fillText(n+' m',x-4,443)}if(n>=0&&n%5===0){this.line({x,y:405},{x,y:333},'#9caa89',2);this.path([['moveTo',x,334],['lineTo',x+32,334],['lineTo',x+28,355],['lineTo',x,355],['closePath']],n===0?'#48765a':'#f2e6bb');c.fillStyle=n===0?'#edf3d6':'#6c7d56';c.font='bold 9px system-ui';c.fillText(n===0?'START':n+' m',x+3,347)}}
 const feet=w.legs;this.ellipse(w.torso.position.x+10,FLOOR+2,65,7,'#685d3a18');
 for(let i=0;i<2;i++){const l=feet[i];if(l.planted){this.line({x:l.foot.position.x-24,y:409},{x:l.foot.position.x+25,y:409},i?'#b9785088':'#4d775e88',5);}}
 const far=feet[1],near=feet[0];this.arm(point(w.torso,-19,-31),angle(far.thigh.angle-w.torso.angle),true);
 for(const i of [1,0]){const l=feet[i],m=pose(w,l);c.save();if(i===1)c.globalAlpha=.82;this.limb(l.thigh,80,18,10,true,m,i===1,this.bones);this.limb(l.shin,70,10,6,false,m,i===1,this.bones);this.ellipse(point(l.thigh,0,40).x,point(l.thigh,0,40).y,9,10,i?'#ceaa92':'#e8c7a8');
 // Leg identity bands are part of the outfit, not separate bone sticks.
 c.save();c.translate(l.thigh.position.x,l.thigh.position.y);c.rotate(l.thigh.angle);c.fillStyle=i?'#c68b64':'#6c905e';c.fillRect(-16,-32,32,7);c.fillStyle='#f7f0db';c.font='bold 5px system-ui';c.fillText(i?'R':'L',-2,-26);c.restore();this.shoe(l,i);c.restore();}
 this.torso(w);this.arm(point(w.torso,20,-31),angle(near.thigh.angle-w.torso.angle),false);
 c.restore();
 }
}
root.WalkArt={WalkIllustration,pose};
})(typeof window!=='undefined'?window:globalThis);
