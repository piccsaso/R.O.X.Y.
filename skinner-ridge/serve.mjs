import {handleTts} from './tts.mjs';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

const directory = process.cwd();
const port = Number(process.env.PORT || process.argv[2] || 8080);
const host = process.env.HOST || (process.env.RENDER === 'true' ? '0.0.0.0' : '127.0.0.1');
const appFiles=new Set(['/','/index.html','/viewer.mjs','/ground.mjs','/landscape.mjs','/terrain-0.glb','/terrain-1.glb','/terrain-2.glb','/terrain-3.glb','/sky.mjs','/lighting.mjs','/apron.mjs','/sky-data.json','/stars.png','/ground.bin','/terrain.json','/route.json','/speech.mjs','/hud.mjs','/nav.mjs','/terrain-coverage.png']);
const mime = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript',
  '.json':'application/json', '.png':'image/png', '.glb':'model/gltf-binary'
};
for (const path of ['/overlays.mjs','/observations/minerals.png','/observations/thermal.png']) appFiles.add(path);
for (const path of ['/weather.mjs','/weather-data/summary.json']) appFiles.add(path);
createServer(async (request,response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    if (pathname === '/api/tts') return await handleTts(request, response);
    const file = resolve(directory,'.'+(pathname==='/'?'/index.html':pathname));
    if (!file.startsWith(directory+sep)) throw new Error('Outside server directory');
    if (!appFiles.has(pathname) && !['/node_modules/three/build/','/node_modules/three/examples/jsm/'].some(prefix=>pathname.startsWith(prefix) && !pathname.includes('..') && !pathname.includes(String.fromCharCode(92)))) {
      throw new Error('Outside demo routes');
    }
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    response.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Length':info.size});
    createReadStream(file).on('error',() => response.destroy()).pipe(response);
  } catch {
    response.writeHead(404).end('File not found');
  }
}).listen(port,host,() => console.log(`Server listening on http://${host}:${port}`));
