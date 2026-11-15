import fs from 'node:fs';
import jpeg from 'jpeg-js';

function exportTile({positions,uv,triangles,image,width,depth,step,x0,z0,file}) {
const count=width*depth;
const gltf = {
  asset:{version:'2.0', generator:'Skinner Ridge surface fusion'},
  extensionsUsed:['KHR_materials_unlit'],
  scene:0, scenes:[{nodes:[0]}], nodes:[{mesh:0,extras:{width,depth,step,x0,z0}}], meshes:[{primitives:[]}],
  buffers:[{byteLength:0}], bufferViews:[], accessors:[], images:[], textures:[], materials:[]
};
const chunks = [];
let offset = 0;
function view(buffer, target) {
  const id = gltf.bufferViews.length;
  gltf.bufferViews.push({buffer:0, byteOffset:offset, byteLength:buffer.length, ...(target ? {target} : {})});
  const pad = Buffer.alloc((4-buffer.length%4)%4);
  chunks.push(buffer,pad);
  offset += buffer.length+pad.length;
  return id;
}
function accessor(data, n) {
  const type = n === 3 ? 'VEC3' : 'VEC2';
  const min = Array(n).fill(Infinity), max = Array(n).fill(-Infinity);
  for (let i=0; i<data.length; i++) {
    const component = i%n;
    min[component] = Math.min(min[component],data[i]);
    max[component] = Math.max(max[component],data[i]);
  }
  const id = gltf.accessors.length;
  gltf.accessors.push({bufferView:view(Buffer.from(new Float32Array(data).buffer),34962),
    componentType:5126,count:data.length/n,type,min,max});
  return id;
}

const indexAccessor=gltf.accessors.length;
gltf.accessors.push({bufferView:view(Buffer.from(triangles.buffer),34963),componentType:5125,
  type:"SCALAR",count:triangles.length,min:[0],max:[count-1]});
gltf.images.push({bufferView:view(image),mimeType:'image/jpeg'});
gltf.textures.push({source:0});
gltf.materials.push({extensions:{KHR_materials_unlit:{}},pbrMetallicRoughness:{baseColorTexture:{index:0}}});
gltf.meshes[0].primitives.push({attributes:{POSITION:accessor(positions,3),TEXCOORD_0:accessor(uv,2)},indices:indexAccessor,material:0});

gltf.buffers[0].byteLength = offset;
const json = JSON.stringify(gltf);
const doc = Buffer.from(json.padEnd(json.length+(4-json.length%4)%4,' '));
const header = Buffer.alloc(20);
header.write('glTF'); header.writeUInt32LE(2,4);
header.writeUInt32LE(28+doc.length+offset,8);
header.writeUInt32LE(doc.length,12); header.write('JSON',16);
const binary = Buffer.alloc(8);
binary.writeUInt32LE(offset); binary.write('BIN\0',4);
fs.writeFileSync(file,Buffer.concat([header,doc,binary,...chunks]));

}
export function exportTerrain({filled,pixels,width,depth,step,scale=7}) {
const iw=(width-1)*scale, tiles=[];
const halfX=(width-1)/2,halfZ=(depth-1)/2;
for(let tz=0;tz<2;tz++)for(let tx=0;tx<2;tx++) {
 const x0=tx*halfX,z0=tz*halfZ,w=halfX+1,d=halfZ+1;
 const positions=new Float32Array(w*d*3),uv=new Float32Array(w*d*2);
 for(let z=0;z<d;z++)for(let x=0;x<w;x++) {
  const i=z*w+x;positions.set([(x0+x)*step,filled[(z0+z)*width+x0+x],(z0+z)*step],i*3);
  uv.set([x/halfX,z/halfZ],i*2);
 }
 const triangles=new Uint32Array(halfX*halfZ*6);
 for(let z=0;z<halfZ;z++)for(let x=0;x<halfX;x++) {
  const a=z*w+x,b=a+1,c=a+w,d=c+1;triangles.set([a,c,b,b,c,d],(z*halfX+x)*6);
 }
 const pw=halfX*scale,ph=halfZ*scale,data=Buffer.alloc(pw*ph*4);
 for(let y=0;y<ph;y++) pixels.copy(data,y*pw*4,((z0*scale+y)*iw+x0*scale)*4,((z0*scale+y)*iw+x0*scale+pw)*4);
 const image=jpeg.encode({data,width:pw,height:ph},94).data;
 const tile={file:'terrain-'+(tz*2+tx)+'.glb',x0,z0,width:w,depth:d,step};
 exportTile({...tile,positions,uv,triangles,image});tiles.push(tile);
}
return tiles;
}
