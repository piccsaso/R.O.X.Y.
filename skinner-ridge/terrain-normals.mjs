// This code was assisted through the use of SI.
import fs from 'node:fs';
const meta=JSON.parse(fs.readFileSync('terrain.json'));
const bytes=Uint8Array.from(fs.readFileSync('ground.bin'));
const heights=new Float32Array(bytes.buffer,0,meta.width*meta.depth);
for(const tile of meta.tiles) {
 const original=fs.readFileSync(tile.file),length=original.readUInt32LE(12);
 const doc=JSON.parse(original.subarray(20,20+length)),binary=original.subarray(28+length);
 const primitive=doc.meshes[0].primitives[0];if(primitive.attributes.NORMAL!==undefined)continue;
 const normals=new Float32Array(tile.width*tile.depth*3);
 for(let z=0;z<tile.depth;z++)for(let x=0;x<tile.width;x++) {
  const xx=x+tile.x0,zz=z+tile.z0,l=Math.max(0,xx-1),r=Math.min(meta.width-1,xx+1),u=Math.max(0,zz-1),d=Math.min(meta.depth-1,zz+1);
  const dx=(heights[zz*meta.width+r]-heights[zz*meta.width+l])/((r-l)*meta.step);
  const dz=(heights[d*meta.width+xx]-heights[u*meta.width+xx])/((d-u)*meta.step),n=Math.hypot(dx,1,dz);
  normals.set([-dx/n,1/n,-dz/n],(z*tile.width+x)*3);
 }
 const view=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:binary.length,byteLength:normals.byteLength,target:34962});
 primitive.attributes.NORMAL=doc.accessors.length;doc.accessors.push({bufferView:view,componentType:5126,count:normals.length/3,type:'VEC3'});
 doc.buffers[0].byteLength+=normals.byteLength;
 const str=JSON.stringify(doc),json=Buffer.from(str.padEnd((str.length+3)&~3,' ')),header=Buffer.alloc(20),bh=Buffer.alloc(8);
 header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+doc.buffers[0].byteLength,8);header.writeUInt32LE(json.length,12);header.write('JSON',16);
 bh.writeUInt32LE(doc.buffers[0].byteLength);bh.write('BIN\0',4);
 fs.writeFileSync(tile.file,Buffer.concat([header,json,bh,binary,Buffer.from(normals.buffer)]));
}
console.log('Shared border normals exported');
