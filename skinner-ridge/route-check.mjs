import {readFileSync,writeFileSync} from 'node:fs';
import {makeGround} from './ground.mjs';
import {PNG} from 'pngjs';

const meta = JSON.parse(readFileSync('terrain.json'));
const data = Uint8Array.from(readFileSync('ground.bin')).buffer;
const ground = makeGround(meta,data);
const [width,depth] = meta.boundsMeters;
const xOffset=meta.origin[1]+4;
const zOffset=84-meta.origin[0];
// Preserve the original approach and look-back, expressed in the larger crop.
const angle=3*Math.PI/8;
const length=3.545;
const targetX=xOffset+1.992710848690013, targetZ=zOffset+4.099211867188213;
const spawn={x:xOffset+0.90,z:zOffset+2.82,targetX,targetZ};
const end={x:spawn.x+Math.cos(angle)*length,z:spawn.z+Math.sin(angle)*length,targetX,targetZ};
const best={length,spawn,return:end};
for (let t=0;t<=1;t+=0.005) {
  if (!Number.isFinite(ground.foot(spawn.x+(end.x-spawn.x)*t,spawn.z+(end.z-spawn.z)*t))) {
    throw new Error('The original slab route has lost walkable clearance');
  }
}
// Find a straight continuation with a wide, swept walking lane.
const start=best.return;
let expansion;
for (let angle=0;angle<Math.PI*2;angle+=Math.PI/120) {
  const dx=Math.cos(angle), dz=Math.sin(angle);
  let distance=0;
  for (let d=0.035;d<=16;d+=0.035) {
    const x=start.x+dx*d, z=start.z+dz*d;
    if (![0,-0.10,0.10].every(off=>Number.isFinite(ground.foot(x-dz*off,z+dx*off)))) break;
    distance=d;
  }
  // Leave room to turn and avoid framing the crop edge at the endpoint.
  distance-=0.55;
  const x=start.x+dx*distance, z=start.z+dz*distance;
  const inOldCrop=x>3.5 && x<23.1 && z>3.5 && z<21;
  if (!inOldCrop && distance>7 && (!expansion || distance>expansion.length)) {
    expansion={length:distance,end:{x,z,targetX:start.x,targetZ:start.z}};
  }
}
if (!expansion) throw new Error('No expanded walking lane');
best.expansion=expansion;

const coverage=PNG.sync.read(readFileSync('terrain-coverage.png'));
let infill;
for (let heading=0;heading<Math.PI*2;heading+=Math.PI/120) {
  const dx=Math.cos(heading), dz=Math.sin(heading);
  let filledDistance=0;
  for (let distance=meta.step;distance<=8.5;distance+=meta.step) {
    const x=spawn.x+dx*distance, z=spawn.z+dz*distance;
    if (![0,-0.1,0.1].every(off=>Number.isFinite(ground.foot(x-dz*off,z+dx*off)))) break;
    const cell=Math.floor(z/meta.step)*coverage.width+Math.floor(x/meta.step);
    if (coverage.data[cell*4]===103) filledDistance+=meta.step;
    if (distance<5 || filledDistance<0.8) continue;
    const score=filledDistance+distance*0.15;
    if (!infill || score>infill.score) infill={length:distance,end:{x,z},filledDistance,score};
  }
}
if (!infill) throw new Error('No walkable route across the inferred sections');
best.infill=infill;

// Estimate connected walkable area by tracing neighborhood links on a 14 cm grid.
const spacing=4*meta.step;
const cols=Math.floor(width/spacing), rows=Math.floor(depth/spacing);
const startCol=Math.floor(best.spawn.x/spacing), startRow=Math.floor(best.spawn.z/spacing);
const visited=new Uint8Array(cols*rows);
const queue=[startRow*cols+startCol];
visited[queue[0]]=1;
for (let j=0;j<queue.length;j++) {
  const i=queue[j], col=i%cols, row=Math.floor(i/cols);
  for (const [cx,cz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    const u=col+cx, v=row+cz, n=v*cols+u;
    if (u<0 || v<0 || u>=cols || v>=rows || visited[n]) continue;
    if (![0,0.25,0.5,0.75,1].every(t=>Number.isFinite(
      ground.foot((col+0.5+cx*t)*spacing,(row+0.5+cz*t)*spacing)))) continue;
    visited[n]=1;
    queue.push(n);
  }
}
best.connectedWalkableSquareMeters=Math.round(queue.length*spacing**2);
writeFileSync('route.json',JSON.stringify(best,null,2)+'\n');
console.log(best);
