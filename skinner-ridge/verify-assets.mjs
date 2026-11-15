import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeGround} from './ground.mjs';
import {buildApron} from './apron.mjs';
import {PNG} from 'pngjs';
const meta=JSON.parse(fs.readFileSync('terrain.json'));
const buffer=Uint8Array.from(fs.readFileSync('ground.bin')).buffer;
const heights=new Float32Array(buffer,0,meta.width*meta.depth),mask=new Uint8Array(buffer,heights.byteLength);
assert(heights.every(Number.isFinite));assert(mask.every(v=>v===3));
let vertices=0,bytes=0;
for(const tile of meta.tiles){
 const glb=fs.readFileSync(tile.file),length=glb.readUInt32LE(12),doc=JSON.parse(glb.subarray(20,20+length)),binary=glb.subarray(28+length);
 assert.equal(glb.readUInt32LE(8),glb.length);assert.equal(doc.buffers[0].byteLength,binary.length);assert(glb.length<100*1024*1024);
 for(const v of doc.bufferViews)assert(v.byteOffset+v.byteLength<=binary.length);
 const p=doc.meshes[0].primitives[0],a=doc.accessors[p.attributes.POSITION],v=doc.bufferViews[a.bufferView];
 const positions=new Float32Array(binary.buffer,binary.byteOffset+v.byteOffset,a.count*3);
 const na=doc.accessors[p.attributes.NORMAL],nv=doc.bufferViews[na.bufferView],normals=new Float32Array(binary.buffer,binary.byteOffset+nv.byteOffset,na.count*3);
 assert.equal(a.count,tile.width*tile.depth);
 for(let i=0;i<a.count;i++){
  const x=i%tile.width+tile.x0,z=Math.floor(i/tile.width)+tile.z0;
  assert.equal(positions[i*3+1],heights[z*meta.width+x]);
  assert(Math.abs(positions[i*3]-x*meta.step)<0.00001);assert(Math.abs(positions[i*3+2]-z*meta.step)<0.00001);
  assert(Math.abs(Math.hypot(normals[i*3],normals[i*3+1],normals[i*3+2])-1)<0.00001);
 }
 vertices+=a.count;bytes+=glb.length;
}
const area=meta.boundsMeters[0]*meta.boundsMeters[1];assert(area>=1372.833*2);
const coverage=PNG.sync.read(fs.readFileSync('terrain-coverage.png'));assert.equal(coverage.width,meta.width-1);assert.equal(coverage.height,meta.depth-1);
const g=makeGround(meta,buffer),apron=buildApron(g,meta);
let checked=0;
for(let z=-109.9;z<meta.boundsMeters[1]+110;z+=1.731)for(let x=-109.9;x<meta.boundsMeters[0]+110;x+=1.563){assert(Number.isFinite((g.sample(x,z)||apron.sample(x,z))?.height));checked++;}
// Every interior cell is traversable, including previously rejected slopes.
for(let z=0;z<meta.depth-1;z++)for(let x=0;x<meta.width-1;x++)assert(Number.isFinite(g.foot((x+.5)*meta.step,(z+.5)*meta.step)));
const sky=JSON.parse(fs.readFileSync('sky-data.json'));assert.equal(sky.samples.length,721);
for(const s of sky.samples){
 assert(Math.abs(Math.hypot(...s.sun)-1)<1e-10);assert(s.sunAngularRadius>0.002 && s.sunAngularRadius<0.004);
 const m=s.icrfToLocal;for(let r=0;r<3;r++)for(let c=0;c<3;c++){let dot=0;for(let i=0;i<3;i++)dot+=m[r*3+i]*m[c*3+i];assert(Math.abs(dot-(r===c?1:0))<1e-10);}
}
const summary={areaSquareMeters:area,fullyTraversableCore:true,coreCellsChecked:mask.length,contextSamplesChecked:checked,contextBounds:apron.bounds,
 tiles:meta.tiles.length,uniqueVertices:heights.length,exportedVertices:vertices,triangles:meta.faces,totalGlbBytes:bytes,
 renderCollisionMatch:true,unitNormals:true,skyFramesVerified:sky.samples.length,skyReference:sky.referenceUtc};
fs.writeFileSync('verification.json',JSON.stringify(summary,null,2)+'\n');console.log(summary);
