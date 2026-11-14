import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import jpeg from 'jpeg-js';

const file='terrain.glb';
const original=readFileSync(file);
const jsonLength=original.readUInt32LE(12);
const document=JSON.parse(original.subarray(20,20+jsonLength));
const binary=original.subarray(28+jsonLength);
const imageView=document.bufferViews[document.images[0].bufferView];
if (document.extras?.photoSeamsPolished) process.exit(0);
const photo=jpeg.decode(binary.subarray(imageView.byteOffset,imageView.byteOffset+imageView.byteLength),{
  useTArray:true,maxMemoryUsageInMB:1536
});
const meta=JSON.parse(readFileSync('terrain.json'));
const scale=photo.width/(meta.width-1);
const {data,width,height}=photo;

// A discontinuity aligned to the mesh's regular grid, with a much smaller
// gradient on either side, is usually a projection seam. Feather that jump
// over nearby texels while retaining the source texture on each side.
let edges=0;
function feather(at, stride) {
  const left=at-stride, right=at;
  const jump=Math.abs(data[right+1]-data[left+1]);
  const before=Math.abs(data[left+1]-data[left-stride+1]);
  const after=Math.abs(data[right+1]-data[right+stride+1]);
  const seam=jump-1.7*Math.max(before,after);
  if (seam<2 || jump>54) return;
  const weight=Math.min(0.46,0.22+seam*0.02);
  for (let channel=0;channel<3;channel++) {
    const shift=(data[right+channel]-data[left+channel])*weight;
    data[left+channel]=Math.round(data[left+channel]+shift);
    data[right+channel]=Math.round(data[right+channel]-shift);
    const left2=left-stride+channel,right2=right+stride+channel;
    data[left2]=Math.round(Math.max(0,Math.min(255,data[left2]+shift*0.42)));
    data[right2]=Math.round(Math.max(0,Math.min(255,data[right2]-shift*0.42)));
  }
  edges++;
}
for (let y=0;y<height;y++) for (let x=scale;x<width-1;x+=scale) feather((y*width+x)*4,4);
for (let y=scale;y<height-1;y+=scale) for (let x=0;x<width;x++) feather((y*width+x)*4,width*4);
const polished=jpeg.encode(photo,96).data;
const pad=Buffer.alloc((4-polished.length%4)%4);
const before=binary.subarray(0,imageView.byteOffset);
const after=binary.subarray(imageView.byteOffset+((imageView.byteLength+3)&~3));
const delta=polished.length+pad.length-((imageView.byteLength+3)&~3);
for (const view of document.bufferViews) {
  if (view.byteOffset>imageView.byteOffset) view.byteOffset+=delta;
}
imageView.byteLength=polished.length;
document.buffers[0].byteLength+=delta;
document.extras={...document.extras,photoSeamsPolished:true};
const json=JSON.stringify(document);
const padded=Buffer.from(json.padEnd(json.length+(4-json.length%4)%4,' '));
const header=Buffer.from(original.subarray(0,20));
header.writeUInt32LE(28+padded.length+document.buffers[0].byteLength,8);
header.writeUInt32LE(padded.length,12);
const binHeader=Buffer.from(original.subarray(20+jsonLength,28+jsonLength));
binHeader.writeUInt32LE(document.buffers[0].byteLength,0);
writeFileSync(file+'.part',Buffer.concat([header,padded,binHeader,before,polished,pad,after]));
renameSync(file+'.part',file);
console.log({featheredTextureEdges:edges});
