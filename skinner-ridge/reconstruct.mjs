import fs from 'node:fs';
import crypto from 'node:crypto';
import { bakeAtlas } from './atlas.mjs';
import { completeHeights, softenStitchSteps, polishSurface } from './infill.mjs';
import { PNG } from 'pngjs';

const sources = JSON.parse(fs.readFileSync('sources.json'));
const step = 0.035;
const origin = [72.45, 8.32, -14];
const width = 1133;
const depth = 991;
const shiftX=origin[1]-2.51, shiftZ=77.49-origin[0];
const count = width * depth;
const index = (x, z) => z * width + x;
const edgeLimit = 0.32;
const agreement = 0.10;

function raster(source) {
  const folder = 'source/' + source.id;
  const label = fs.readFileSync(folder + '.obj.xml', 'utf8');
  if (!label.includes('>SITE_FRAME<') ||
      !label.includes('<geom:index_value_number>26</geom:index_value_number>') ||
      !label.includes('<file_name>' + source.id + '.obj</file_name>')) {
    throw new Error('Unexpected terrain label for ' + source.id);
  }
  const positions = [], uv = [];
  const heights = new Float32Array(count).fill(NaN);
  const density = new Float32Array(count).fill(Infinity);
  const texcoords = new Float32Array(count * 2);
  const obj = fs.readFileSync(folder + '.obj', 'utf8');
  let rejected = 0;
  for (const line of obj.split('\n')) {
    if (!/^(v |vt |f )/.test(line)) continue;
    const [kind, ...values] = line.trim().split(/\s+/);
    if (kind === 'v') {
      const [north, east, down] = values.map(Number);
      positions.push([(origin[1] - east) / step, (north - origin[0]) / step, origin[2] - down]);
    } else if (kind === 'vt') {
      uv.push([Number(values[0]), 1 - Number(values[1])]);
    } else {
      if (values.length !== 3) throw new Error('Expected triangular OBJ faces');
      const refs = values.map(value => value.split('/').map(n => Number(n) - 1));
      const [a, b, c] = refs.map(([v]) => positions[v]);
      const lowX = Math.max(0, Math.ceil(Math.min(a[0], b[0], c[0])));
      const highX = Math.min(width - 1, Math.floor(Math.max(a[0], b[0], c[0])));
      const lowZ = Math.max(0, Math.ceil(Math.min(a[1], b[1], c[1])));
      const highZ = Math.min(depth - 1, Math.floor(Math.max(a[1], b[1], c[1])));
      if (lowX > highX || lowZ > highZ) continue;
      const size = Math.max(...[[a,b],[b,c],[c,a]].map(([p,q]) =>
        Math.hypot((p[0]-q[0])*step, (p[1]-q[1])*step, p[2]-q[2])));
      if (size > edgeLimit) {
        rejected++;
        continue;
      }
      const bx = b[0]-a[0], bz = b[1]-a[1], cx = c[0]-a[0], cz = c[1]-a[1];
      const determinant = bx*cz - bz*cx;
      if (Math.abs(determinant) < 1e-10) continue;
      const [ta, tb, tc] = refs.map(([,t]) => uv[t]);
      for (let z = lowZ; z <= highZ; z++) for (let x = lowX; x <= highX; x++) {
        const u = ((x-a[0])*cz - (z-a[1])*cx) / determinant;
        const v = (bx*(z-a[1]) - bz*(x-a[0])) / determinant;
        const w = 1-u-v;
        if (Math.min(u,v,w) < -1e-5) continue;
        const i = index(x,z);
        const height = a[2]*w + b[2]*u + c[2]*v;
        // A vertical survey ray can cross a rock more than once.
        if (Number.isFinite(heights[i]) && height < heights[i]) continue;
        heights[i] = height;
        density[i] = size;
        texcoords[i*2] = ta[0]*w + tb[0]*u + tc[0]*v;
        texcoords[i*2+1] = ta[1]*w + tb[1]*u + tc[1]*v;
      }
    }
  }
  const references = [...label.matchAll(/<lidvid_reference>([^<]+)<\/lidvid_reference>/g)].map(m => m[1]);
  const motion = label.match(/<geom:Motion_Counter>[\s\S]*?<\/geom:Motion_Counter>/)?.[0] ?? '';
  const motionCounter = [...motion.matchAll(/<geom:index_value_number>(\d+)<\/geom:index_value_number>/g)].map(m => Number(m[1]));
  if (motionCounter[0] !== source.site || motionCounter[1] !== source.drive) throw new Error('Unexpected motion counter');
  const sha256 = Object.fromEntries(['obj','obj.xml','png'].map(ext => [
    ext, crypto.createHash('sha256').update(fs.readFileSync(folder + '.' + ext)).digest('hex')
  ]));
  return { heights, density, texcoords, rejected, references, motionCounter, sha256 };
}

const layers = sources.map(raster);
const fused = new Float32Array(count).fill(NaN);
let covered = 0, overlap = 0, crossDrive = 0, disagreements = 0;
const sampleUse = sources.map(() => 0);
for (let i = 0; i < count; i++) {
  const candidates = layers.filter(l => Number.isFinite(l.heights[i]));
  if (!candidates.length) continue;
  covered++;
  if (candidates.length > 1) overlap++;
  candidates.sort((a,b) => a.density[i]-b.density[i]);
  const reference = candidates[0].heights[i];
  const agreeing = candidates.filter(l => Math.abs(l.heights[i]-reference)<=agreement);
  if (new Set(agreeing.map(l=>sources[layers.indexOf(l)].drive)).size>1) crossDrive++;
  let height = 0, weight = 0;
  for (const layer of candidates) {
    if (Math.abs(layer.heights[i]-reference) > agreement) {
      disagreements++;
      continue;
    }
    const confidence = 1 / Math.max(0.015, layer.density[i]);
    sampleUse[layers.indexOf(layer)]++;
    height += layer.heights[i]*confidence;
    weight += confidence;
  }
  fused[i] = height/weight;
}

const cols=width-1, rows=depth-1;
const measuredFaces=new Uint8Array(cols*rows);
function supported(indices) {
  const heights=indices.map(i=>fused[i]);
  if (heights.some(height=>!Number.isFinite(height)) || Math.max(...heights)-Math.min(...heights)>0.20) return false;
  return layers.some(layer=>indices.every(i=>Math.abs(layer.heights[i]-fused[i])<=agreement));
}

for (let z=0;z<rows;z++) for (let x=0;x<cols;x++) {
  const a=index(x,z), b=a+1, c=a+width, d=c+1;
  // Reject the surveyed spike from the original small crop.
  if (x*step>12.73+shiftX && x*step<13.60+shiftX && z*step>6.5+shiftZ && z*step<7.91+shiftZ &&
      [a,b,c,d].some(i=>fused[i]>0.33)) continue;
  measuredFaces[z*cols+x]=Number(supported([a,c,b]))+2*Number(supported([b,c,d]));
}
// Below this size, isolated stereo fragments are too small to anchor the fill.
const seen=new Uint8Array(measuredFaces.length);
for (let i=0;i<measuredFaces.length;i++) {
  if (!measuredFaces[i] || seen[i]) continue;
  const component=[i];
  seen[i]=1;
  for (let j=0;j<component.length;j++) {
    const k=component[j];
    for (const n of [k-cols,k+cols,k%cols?k-1:-1,k%cols<cols-1?k+1:-1]) {
      if (!measuredFaces[n] || seen[n]) continue;
      seen[n]=1;
      component.push(n);
    }
  }
  if (component.length<128) for (const n of component) measuredFaces[n]=0;
}
const surveyedFaces=measuredFaces.reduce((sum,bits)=>sum+Number(Boolean(bits&1))+Number(Boolean(bits&2)),0);
if (!surveyedFaces) throw new Error('No supported triangles in crop');

const completed=completeHeights(fused,measuredFaces,width,depth,step);
const limited=softenStitchSteps(completed,width,depth,step,{x0:7.7+shiftX,x1:9.3+shiftX,z0:9.8+shiftZ,z1:11.3+shiftZ});
const filled=polishSurface(limited,fused,width,depth);
// Joint photo/relief completion modifies inferred heights before either export.
const {image,counts,coverage} = bakeAtlas({sources,layers,width,depth,fused,filled,mask:measuredFaces,agreement});
let softenedSamples=0;
for (let i=0;i<filled.length;i++) {
  if (Math.abs(filled[i]-completed[i])>0.04) softenedSamples++;
}
const positions=new Float32Array(count*3);
const uv=new Float32Array(count*2);
for (let i=0;i<count;i++) {
  const col=i%width, row=Math.floor(i/width);
  positions.set([col*step,filled[i],row*step],i*3);
  uv.set([col/cols,row/rows],i*2);
}
const ground=new Uint8Array(cols*rows).fill(3);
const triangles=new Uint32Array(ground.length*6);
for (let i=0;i<ground.length;i++) {
  const a=Math.floor(i/cols)*width+i%cols, b=a+1, c=a+width, d=c+1;
  triangles.set([a,c,b,b,c,d],i*6);
}
const faces=triangles.length/3;
const gltf = {
  asset:{version:'2.0', generator:'Skinner Ridge surface fusion'},
  extensionsUsed:['KHR_materials_unlit'],
  scene:0, scenes:[{nodes:[0]}], nodes:[{mesh:0}], meshes:[{primitives:[]}],
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
const used = sources.map((source,j) => {
  const { rejected, references, motionCounter, sha256 } = layers[j];
  return {...source,rejected,references,motionCounter,sha256,fusedSamples:sampleUse[j],atlasTriangles:counts[j]};
});
gltf.buffers[0].byteLength = offset;
const json = JSON.stringify(gltf);
const doc = Buffer.from(json.padEnd(json.length+(4-json.length%4)%4,' '));
const header = Buffer.alloc(20);
header.write('glTF'); header.writeUInt32LE(2,4);
header.writeUInt32LE(28+doc.length+offset,8);
header.writeUInt32LE(doc.length,12); header.write('JSON',16);
const binary = Buffer.alloc(8);
binary.writeUInt32LE(offset); binary.write('BIN\0',4);
fs.writeFileSync('terrain.glb',Buffer.concat([header,doc,binary,...chunks]));
fs.writeFileSync('ground.bin', Buffer.concat([Buffer.from(filled.buffer),Buffer.from(ground)]));
const metadata = {step,width,depth,origin,boundsMeters:[(width-1)*step,(depth-1)*step],
  faces,surveyedFaces,inferredFaces:faces-surveyedFaces,softenedSamples,covered,overlap,crossDrive,disagreements,coverage,sources:used,
  completion:{method:'Joint Navcam photo and detrended relief quilting; inferred, not new stereo measurements',seed:671167,
    reference:'https://science.nasa.gov/resource/perseverance-workspace-at-skinner-ridge/',
    baselineAreaSquareMeters:686,areaSquareMeters:(width-1)*(depth-1)*step*step}};
fs.writeFileSync('terrain.json',JSON.stringify(metadata,null,2)+'\n');
const provenance=new PNG({width:cols,height:rows});
for (let i=0;i<measuredFaces.length;i++) {
  const color=[[103,74,62,255],[169,137,108,255],[169,137,108,255],[235,210,174,255]][measuredFaces[i]];
  provenance.data.set(color,i*4);
}
fs.writeFileSync('terrain-coverage.png',PNG.sync.write(provenance));
console.log({faces,surveyedFaces,inferredFaces:faces-surveyedFaces,softenedSamples,coverage,covered,overlap,crossDrive,disagreements,observationsUsed:used.filter(s=>s.fusedSamples||s.atlasTriangles).length});
