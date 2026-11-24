import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../web/muscle-emphasis.js',import.meta.url),'utf8');
const {teachingMuscleVertex:v,teachingMorphWeights:w}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
for(const s of [0,.5,1])assert.deepEqual(v(.2,.8,.1,.1,.6,.05,0,s),[.2,.8,.1]);
const long=v(.2,.8,.1,.1,.6,.05,1,0),short=v(.2,.8,.1,.1,.6,.05,1,1);
assert(short[0]-.1>2*(long[0]-.1));assert(short[2]-.05>2*(long[2]-.05));assert(short[1]-.6<long[1]-.6);
assert.deepEqual(w(0,true),[0,1,0]);assert.deepEqual(w(125,true),[0,0,1]);assert.deepEqual(w(62.5,true),[0,.5,.5]);assert.deepEqual(w(125,false),[1,0,0]);assert.deepEqual(w(0,false),[0,0,0]);
for(let i=0;i<100;i++){const e=i/99;for(const s of [0,.5,1])assert(v(.2,.8,.1,.1,.6,.05,e,s).every(Number.isFinite));}
console.log('PASS: stronger reciprocal length/thickness contrast, fixed endpoints, continuous morph weights, normal-mode restoration');
