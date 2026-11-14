import {mkdir,readFile,writeFile,rename,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const sources=JSON.parse(await readFile('sources.json','utf8'));
const manifest=JSON.parse(await readFile('terrain.json','utf8').catch(()=> '{"sources":[]}'));
await mkdir('source',{recursive:true});
for (const {id,products} of sources) {
  const expected=manifest.sources.find(source=>source.id===id)?.sha256;
  for (const ext of ['obj','obj.xml','png']) {
    const url=products[ext], path='source/'+id+'.'+ext;
    const local=await stat(path).catch(()=>null);
    if (local?.size && (!expected || hash(await readFile(path))===expected[ext])) continue;
    const response=await fetch(url,{signal:AbortSignal.timeout(180000)});
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
function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
