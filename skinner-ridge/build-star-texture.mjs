import fs from 'node:fs';
import crypto from 'node:crypto';
import {EXRLoader} from 'three/addons/loaders/EXRLoader.js';
import {FloatType} from 'three';
import {PNG} from 'pngjs';
const file='source/sky/starmap.exr';
const url='https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/starmap_2020_4k.exr';
if(!fs.existsSync(file)) {
 fs.mkdirSync('source/sky',{recursive:true});const response=await fetch(url);
 if(!response.ok)throw new Error('NASA star map '+response.status);
 fs.writeFileSync(file,Buffer.from(await response.arrayBuffer()));
}
const bytes=fs.readFileSync(file);
const exr=new EXRLoader().setDataType(FloatType).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const out=new PNG({width:exr.width,height:exr.height});
// Encode HDR into a gamma-corrected display texture. Positions are unchanged. This is an
// exposure choice for a monitor, not a naked-eye limiting-magnitude simulation.
let max=0;
for(let i=0;i<exr.data.length;i+=4)for(let c=0;c<3;c++)max=Math.max(max,exr.data[i+c]);
for(let i=0;i<out.data.length;i+=4) {
 for(let c=0;c<3;c++) out.data[i+c]=Math.round(255*Math.min(1,Math.pow(Math.max(0,exr.data[i+c])*0.75,1/2.2)));
 out.data[i+3]=255;
}
const encoded=PNG.sync.write(out);fs.writeFileSync('stars.png',encoded);
const manifest=JSON.parse(fs.readFileSync('sky-data.json'));
manifest.starMap.assetUrl=url;manifest.starMap.sourceSha256=crypto.createHash('sha256').update(bytes).digest('hex');
manifest.starMap.displaySha256=crypto.createHash('sha256').update(encoded).digest('hex');
fs.writeFileSync('sky-data.json',JSON.stringify(manifest)+'\n');
console.log({width:exr.width,height:exr.height,max});
