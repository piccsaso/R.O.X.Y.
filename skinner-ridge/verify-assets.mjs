import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {makeGround} from './ground.mjs';
import {PNG} from 'pngjs';

const meta=JSON.parse(readFileSync('terrain.json'));
const route=JSON.parse(readFileSync('route.json'));
const glb=readFileSync('terrain.glb');
assert.equal(glb.toString('utf8',0,4),'glTF');
assert.equal(glb.readUInt32LE(8),glb.length);
const jsonLength=glb.readUInt32LE(12),doc=JSON.parse(glb.subarray(20,20+jsonLength));
const binary=glb.subarray(28+jsonLength);
assert.equal(doc.buffers[0].byteLength,binary.length);
for(const view of doc.bufferViews) assert(view.byteOffset+view.byteLength<=binary.length);
const primitive=doc.meshes[0].primitives[0];
const accessor=doc.accessors[primitive.attributes.POSITION],view=doc.bufferViews[accessor.bufferView];
const positions=new Float32Array(binary.buffer,binary.byteOffset+view.byteOffset,accessor.count*3);
const buffer=Uint8Array.from(readFileSync('ground.bin')).buffer;
const heights=new Float32Array(buffer,0,meta.width*meta.depth);
const mask=new Uint8Array(buffer,heights.byteLength);
assert.equal(heights.length,accessor.count);
assert.equal(mask.length,(meta.width-1)*(meta.depth-1));
for(let i=0;i<heights.length;i++) {
  assert(Number.isFinite(heights[i]),'Non-finite collision height');
  assert.equal(positions[i*3+1],heights[i],'Render/collision height mismatch');
  assert(Math.abs(positions[i*3]-i%meta.width*meta.step)<0.00001);
  assert(Math.abs(positions[i*3+2]-Math.floor(i/meta.width)*meta.step)<0.00001);
}
assert(mask.every(v=>v===3),'Hole in collision mask');
const coverage=PNG.sync.read(readFileSync('terrain-coverage.png'));
assert.equal(coverage.width,meta.width-1);assert.equal(coverage.height,meta.depth-1);
assert(meta.boundsMeters[0]*meta.boundsMeters[1]>=686*2);
assert(route.connectedWalkableSquareMeters>=613*2,'Connected playable area did not double');
const ground=makeGround(meta,buffer);
for(const p of [route.spawn,route.return,route.expansion.end,route.infill.end,route.lowerPath.start,route.lowerPath.end]) assert(Number.isFinite(ground.foot(p.x,p.z)));
const summary={vertices:heights.length,triangles:meta.faces,areaSquareMeters:meta.boundsMeters[0]*meta.boundsMeters[1],
  connectedWalkableSquareMeters:route.connectedWalkableSquareMeters,stereoSupportedFraction:meta.surveyedFaces/meta.faces,
  matchedRenderAndCollision:true,continuousCollision:true,glbBytes:glb.length};
writeFileSync('verification.json',JSON.stringify(summary,null,2)+'\n');
console.log(summary);
