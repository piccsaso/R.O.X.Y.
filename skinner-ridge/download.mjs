import {mkdir,readFile,writeFile,rename,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const sources=JSON.parse(await readFile('sources.json','utf8'));
const manifest=JSON.parse(await readFile('terrain.json','utf8').catch(()=> '{"sources":[]}'));
await mkdir('source',{recursive:true});
const jobs=sources.flatMap(source=>['obj','obj.xml','png'].map(ext=>({...source,ext})));
async function worker() {
while (jobs.length) {
  const {id,products,ext}=jobs.shift();
  const expected=manifest.sources.find(source=>source.id===id)?.sha256;
    const url=products[ext], path='source/'+id+'.'+ext;
    const local=await stat(path).catch(()=>null);
    if (local?.size && (!expected || hash(await readFile(path))===expected[ext])) continue;
    let response;
    for (let attempt=0;attempt<3;attempt++) {
      try {
        response=await fetch(url,{signal:AbortSignal.timeout(180000)});
        if (response.ok || response.status<500) break;
      } catch(error) { if (attempt===2) throw error; }
      await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));
    }
    if (!response.ok) throw new Error(response.status+' '+url);
    const bytes=Buffer.from(await response.arrayBuffer());
    if (expected && hash(bytes)!==expected[ext]) throw new Error('Checksum mismatch for '+url);
    const valid=ext==='png' ? bytes.length>8 && bytes.readUInt32BE()===0x89504e47
      : ext==='obj.xml' ? bytes.includes(Buffer.from('<Product_Observational'))
      : bytes.subarray(0,512).toString().includes('mtllib ');
    if (!valid) throw new Error('Unexpected response for '+url);
    await writeFile(path+'.part',bytes);
    await rename(path+'.part',path);
    console.log(path);
  }
}
await Promise.all(Array.from({length:4},worker));
function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
