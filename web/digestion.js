import {STAGES,HELPERS,TOTAL,frameAt,advance} from './digestion-data.js';
const $=s=>document.querySelector(s),NS='http://www.w3.org/2000/svg';
const svg=(tag,attrs,parent)=>{const el=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);parent.append(el);return el};
let time=0,playing=false,current=-1,last=0,lastPaint=0,view='path',viewer=null,loading3d=false;
const paths=[],glows=[],dots=[],nutrients=[],micros=[],microOut=[];
const labelPositions=[[84,112,230,115],[74,218,245,215],[397,283,303,286],[401,403,296,411],[78,367,168,367],[393,543,258,539]];
STAGES.forEach((s,i)=>{
 const b=document.createElement('button');b.innerHTML=`<span>0${i+1}</span><b>${s.name}</b>`;b.onclick=()=>jump(i);$('#route').append(b);
 const width=[12,18,12,16,27,15][i];
 glows.push(svg('path',{d:s.path,fill:'none',stroke:s.color,'stroke-width':width+12,opacity:0,filter:'url(#glow)'},$('#gutPaths')));
 svg('path',{d:s.path,fill:'none',stroke:s.color,'stroke-width':width,'stroke-linecap':'round','stroke-linejoin':'round',opacity:i===2?.15:.8},$('#gutPaths'));
 paths.push(svg('path',{d:s.path,fill:'none',stroke:'#f7dbb7','stroke-width':2,opacity:.25,'stroke-dasharray':'4 6'},$('#gutPaths')));
 const [x,y,ax,ay]=labelPositions[i],g=svg('g',{class:'organ-label',role:'button',tabindex:0,'aria-label':s.name+' 관찰'},$('#organLabels'));
 svg('line',{x1:x+(x<250?30:-30),y1:y-4,x2:ax,y2:ay},g);svg('circle',{cx:ax,cy:ay,r:3,fill:s.color},g);const t=svg('text',{x,y,'text-anchor':'middle'},g);t.textContent=s.name;
 g.addEventListener('click',()=>jump(i));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();jump(i)}});
});
for(let i=0;i<24;i++){dots.push(svg('circle',{r:3,fill:'#ffdc83',stroke:'#664c2e','stroke-width':.5},$('#foodDots')));nutrients.push(svg('circle',{r:2.6,fill:'#8be8cc',opacity:0},$('#nutrientDots')));micros.push(svg('circle',{r:4,fill:'#ffdc83'},$('#microDots')));microOut.push(svg('circle',{r:3,fill:'#8be8cc',opacity:0},$('#microOut')))}
for(const [id,h]of Object.entries(HELPERS)){const b=document.createElement('button');b.textContent=h.name;b.onclick=()=>{document.querySelectorAll('#helperButtons button').forEach(x=>x.classList.toggle('active',x===b));$('#helperText').textContent=h.text;viewer?.selectHelper(id)};$('#helperButtons').append(b)}
$('#helperButtons button').click();
function setPlaying(on){playing=on;$('#play').textContent=on?'일시 정지':time>=TOTAL?'다시 여행':'여행 계속';$('#play').setAttribute('aria-pressed',on);$('#playStatus').textContent=on?'음식물의 변화와 이동을 관찰해요.':time>=TOTAL?'여행 완료 · 소화·흡수·배출을 비교해 보세요.':'멈춤 · 기관의 역할을 설명해 보세요.'}
function jump(i){time=Math.max(0,Math.min(5,i))*8;setPlaying(false);draw()}
function draw(){
 const f=frameAt(time),s=STAGES[f.index];
 if(current!==f.index){current=f.index;$('#kind').textContent=s.kind;$('#organName').textContent=s.name;$('#verb').textContent=s.verb;$('#role').textContent=s.role;$('#change').textContent=s.change;$('#note').textContent=s.note;$('#question').textContent=s.question;$('#stageBadge').textContent=`${current+1} / 6 · ${s.name}`;$('#micro').setAttribute('aria-label',s.name+'에서 '+s.verb);document.querySelectorAll('#route button').forEach((b,i)=>{b.classList.toggle('active',i===current);b.setAttribute('aria-current',i===current?'step':'false')});document.querySelectorAll('.organ-label').forEach((g,i)=>g.classList.toggle('active',i===current));glows.forEach((g,i)=>g.setAttribute('opacity',i===current?.5:0));viewer?.setStage(s.id)}
 $('#seek').value=time;$('#positionText').textContent=`${s.name} · ${Math.round(time/TOTAL*100)}%`;$('#previous').disabled=current===0;$('#next').disabled=current===5;
 const p=paths[current].getPointAtLength(paths[current].getTotalLength()*f.fraction),theta=f.fraction*Math.PI*4;
 const count=current<3?24:current===3?Math.max(7,24-Math.floor(f.fraction*17)):7;
 dots.forEach((d,i)=>{const spread=current===0?10-5*f.fraction:current===2?9:6,angle=i*2.4;d.setAttribute('cx',p.x+Math.cos(angle)*spread*(i%4)/3);d.setAttribute('cy',p.y+Math.sin(angle)*spread*(i%4)/3);d.setAttribute('r',current===0?4-2*f.fraction:current>=4?3.5:2);d.setAttribute('opacity',i<count?1:0);d.setAttribute('fill',current>=4?'#c8a16f':'#ffdc83')});
 nutrients.forEach((d,i)=>{const active=current===3||current===4;const progress=(f.fraction*2+i/24)%1;const startX=current===3?240+(i%4)*12:168;const startY=current===3?380+(i%5)*12:375+(i%5)*12;d.setAttribute('cx',startX+(current===3?100:-70)*progress);d.setAttribute('cy',startY-55*progress);d.setAttribute('fill',current===3?'#8be8cc':'#79c9ff');d.setAttribute('opacity',active?Math.sin(progress*Math.PI)*.9:0)});
 $('#stomachBody').setAttribute('transform',current===2?`translate(290 315) scale(${1+Math.sin(theta)*.025} ${1-Math.sin(theta)*.03}) translate(-290 -315)`:'');
 const mf=f.fraction,phase=mf*Math.PI*6;
 $('#microWall').setAttribute('d',current===1?`M20 30 Q${30+mf*290} 75 340 30M20 90 Q${30+mf*290} 45 340 90`:current===2?`M20 30 Q180 ${10+Math.sin(phase)*12} 340 30M20 90 Q180 ${110-Math.sin(phase)*12} 340 90`:'M20 30 Q180 10 340 30M20 90 Q180 110 340 90');
 micros.forEach((d,i)=>{let x=35+(i%8)*38,y=48+Math.floor(i/8)*13,r=3;
 if(current===0){x=100+(i%6)*25+Math.sin(phase+i)*mf*12;y=45+Math.floor(i/6)*10;r=6-3*mf}
 if(current===1){x=35+mf*280+(i%5-2)*4;y=58+(Math.floor(i/5)-2)*4;r=3}
 if(current===2){x=180+Math.cos(phase+i*2.4)*(25+i);y=60+Math.sin(phase+i*2.4)*(8+i*.6);r=4-2*mf}
 if(current===3){x=30+(mf*240+i*13)%300;y=54+(i%3)*7;r=2.6}
 if(current===4){x=100+(i%8)*18*(1-mf*.45)+mf*55;y=47+Math.floor(i/8)*13;r=5-mf}
 if(current===5){x=70+mf*310+(i%6)*4;y=54+Math.floor(i/6)*4;r=4}
 d.setAttribute('cx',x);d.setAttribute('cy',y);d.setAttribute('r',r);d.setAttribute('fill',current>=4?'#c8a16f':'#ffdc83');d.setAttribute('opacity',x<350?1:0);
 const o=microOut[i],q=(mf*2+i/24)%1;const active=current===3||current===4;o.setAttribute('cx',80+(i%8)*27);o.setAttribute('cy',55-q*54);o.setAttribute('fill',current===3?'#8be8cc':'#79c9ff');o.setAttribute('opacity',active?Math.sin(q*Math.PI):0);
 });
 $('#microLabel').textContent=['씹기 + 침의 작용 (변화 원리 모형)','관의 근육이 오므라들며 이동','근육 운동 + 위액과 섞임','초록 점: 영양소가 벽을 지나 몸속으로','파란 점: 물이 벽을 지나 몸속으로','찌꺼기가 몸 밖으로'][current];
}
$('#play').onclick=()=>{if(time>=TOTAL)time=0;setPlaying(!playing);draw()};$('#restart').onclick=()=>{time=0;setPlaying(false);draw()};$('#previous').onclick=()=>jump(current-1);$('#next').onclick=()=>jump(current+1);$('#seek').oninput=e=>{time=+e.target.value;setPlaying(false);draw()};
$('#helpers').onchange=e=>{const on=e.target.checked;$('#helperInfo').hidden=!on;$('#supportOrgans').setAttribute('opacity',on?.8:.15);viewer?.setHelpers(on)};$('#supportOrgans').setAttribute('opacity',.15);
function pathView(){view='path';$('#bodyMap').hidden=false;$('#bodyMap').style.display='block';$('#threeStage').hidden=true;$('#pathView').classList.add('active');$('#pathView').setAttribute('aria-pressed','true');$('#threeView').classList.remove('active');$('#threeView').setAttribute('aria-pressed','false');$('#viewHint').textContent='기관 이름이나 위쪽 순서를 눌러 보세요.'}
$('#pathView').onclick=pathView;
$('#threeView').onclick=async()=>{if(loading3d)return;view='three';$('#bodyMap').style.display='none';$('#threeStage').hidden=false;$('#pathView').classList.remove('active');$('#pathView').setAttribute('aria-pressed','false');$('#threeView').classList.add('active');$('#threeView').setAttribute('aria-pressed','true');$('#viewHint').textContent='드래그로 회전 · 기관의 위치와 모양을 관찰해요.';try{if(!viewer){loading3d=true;const mod=await import('./digestion-3d.js');viewer=await mod.createViewer($('#threeStage'),id=>{const i=STAGES.findIndex(s=>s.id===id);if(i>=0)jump(i)})}viewer.setStage(STAGES[current].id);viewer.setHelpers($('#helpers').checked);viewer.setContext($('#skinContext').checked)}catch(e){$('#threeStatus').textContent='이 기기에서는 3D 모형을 열지 못했어요. ‘소화 경로’ 화면에서 애니메이션을 이용해 주세요.';console.warn(e)}finally{loading3d=false}};
$('#threeReset').onclick=()=>viewer?.reset();$('#skinContext').onchange=e=>viewer?.setContext(e.target.checked);
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{$('#playStatus').textContent='이 브라우저에서는 전체 화면을 지원하지 않아요.'}};
document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden)setPlaying(false)});
const quiz=[{q:'영양소 대부분을 흡수하는 곳은?',a:['위','작은창자','큰창자'],correct:1,why:'작게 분해된 영양소 대부분은 작은창자 벽을 지나 흡수돼요.'},{q:'식도에서 음식물이 이동하는 까닭은?',a:['근육이 차례로 오므라들어서','중력만 작용해서','뼈가 음식물을 밀어서'],correct:0,why:'식도 근육의 연동 운동이 음식물을 밀어 보내요.'},{q:'소화기관의 역할을 바르게 설명한 것은?',a:['물은 큰창자에서만 흡수된다','음식물은 간을 통과한 뒤 위로 간다','간은 소화를 돕는 쓸개즙을 만든다'],correct:2,why:'간은 쓸개즙을 만들어요. 물은 작은창자와 큰창자 모두에서 흡수돼요.'}];
quiz.forEach((q,i)=>{const a=document.createElement('article'),p=document.createElement('p'),feedback=document.createElement('p');p.textContent=`${i+1}. ${q.q}`;a.append(p);feedback.className='feedback';feedback.setAttribute('role','status');q.a.forEach((text,j)=>{const b=document.createElement('button');b.textContent=text;b.onclick=()=>{a.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));feedback.textContent=j===q.correct?'맞아요! '+q.why:'다시 관찰해 봐요. '+q.why};a.append(b)});a.append(feedback);$('#quizItems').append(a)});
function tick(t){requestAnimationFrame(tick);const dt=last?Math.min((t-last)/1000,.15):0;last=t;if(document.hidden)return;if(playing){const r=advance(time,dt*+$('#speed').value,$('#stepPause').checked);time=r.time;if(r.stop)setPlaying(false)}if(t-lastPaint>33){draw();viewer?.render(view==='three');lastPaint=t}}
draw();requestAnimationFrame(tick);
