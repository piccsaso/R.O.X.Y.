// This code was assisted through the use of SI.
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import jpeg from 'jpeg-js';

const master=JSON.parse(readFileSync('terrain.json'));
for(const tile of master.tiles) polish(tile);
function polish(tile) {
const file=tile.file;
const original=readFileSync(file);
const jsonLength=original.readUInt32LE(12);
const document=JSON.parse(original.subarray(20,20+jsonLength));
const binary=original.subarray(28+jsonLength);
const imageView=document.bufferViews[document.images[0].bufferView];
if (document.extras?.photoSeamsPolished) return;
const photo=jpeg.decode(binary.subarray(imageView.byteOffset,imageView.byteOffset+imageView.byteLength),{
  useTArray:true,maxMemoryUsageInMB:1536
});
const meta={...master,...tile};
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
// Gentle geometry-derived contact shading. Remove the local tangent plane
// so a uniformly sloping sand sheet is not darkened like a crevice.
const ground=readFileSync('ground.bin');
const allHeights=new Float32Array(ground.buffer,ground.byteOffset,master.width*master.depth);
const heights=new Float32Array(meta.width*meta.depth);
for(let z=0;z<meta.depth;z++)for(let x=0;x<meta.width;x++)heights[z*meta.width+x]=allHeights[(z+tile.z0)*master.width+x+tile.x0];
const occlusion=new Float32Array(meta.width*meta.depth);
const directions=[[1,0],[-1,0],[0,1],[0,-1],[0.707,0.707],[-0.707,0.707],[0.707,-0.707],[-0.707,-0.707]];
for(let z=2;z<meta.depth-2;z++) for(let x=2;x<meta.width-2;x++) {
  const i=z*meta.width+x,h=heights[i];
  const dx=(heights[i+2]-heights[i-2])/4,dz=(heights[i+2*meta.width]-heights[i-2*meta.width])/4;
  let occ=0;
  for(const [u,v] of directions) {
    let horizon=0;
    for(const radius of [3,6,12,24]) {
      const xx=Math.max(0,Math.min(meta.width-1,Math.round(x+u*radius)));
      const zz=Math.max(0,Math.min(meta.depth-1,Math.round(z+v*radius)));
      const rise=heights[zz*meta.width+xx]-h-dx*(xx-x)-dz*(zz-z);
      horizon=Math.max(horizon,rise/(radius*meta.step));
    }
    occ+=Math.min(0.8,horizon);
  }
  occlusion[i]=Math.min(0.12,occ/directions.length*0.24);
}
for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
  const gx=x/scale,gz=y/scale,col=Math.floor(gx),row=Math.floor(gz),u=gx-col,v=gz-row;
  const i=row*meta.width+col;
  const amount=(occlusion[i]*(1-u)+occlusion[i+1]*u)*(1-v)+
    (occlusion[i+meta.width]*(1-u)+occlusion[i+meta.width+1]*u)*v;
  const p=(y*width+x)*4;
  for(let c=0;c<3;c++) data[p+c]=Math.round(data[p+c]*(1-amount));
}
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
document.extras={...document.extras,photoSeamsPolished:true,contactShading:'Tangent-plane-corrected local occlusion, maximum 12%'};
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

}
