// This code was generated through the use of SI.
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {makeGround} from './ground.mjs';
import {buildApron} from './apron.mjs';
import {PNG} from 'pngjs';
import {once} from 'node:events';

const chrome = process.argv.slice(2).find(arg=>!arg.startsWith('--')) || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 18851, debugging = 18852;
const base = 'http://127.0.0.1:'+port;
const server = spawn(process.execPath,['serve.mjs',String(port)],{stdio:['ignore','pipe','inherit'],windowsHide:true});
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
let browser, ws;
try {
  await once(server.stdout,'data');
  await mkdir('screenshots',{recursive:true});
  browser = spawn(chrome,[
    '--headless=new','--no-first-run','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    ...(process.env.CHROME_NO_SANDBOX==='1' ? ['--no-sandbox','--disable-crash-reporter','--disable-breakpad'] : []),
    '--remote-debugging-port='+debugging,'--user-data-dir='+resolve('.qa-chrome-'+process.pid+'-'+Date.now()),
    'about:blank'
  ],{windowsHide:true,stdio:'ignore'});
  let tabs;
  for (let tries=0;tries<50 && !tabs;tries++) {
    try { tabs=await (await fetch('http://127.0.0.1:'+debugging+'/json/list')).json(); }
    catch { await wait(200); }
  }
  if (!tabs) throw new Error('Chrome debugging endpoint did not open');
  ws=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
  await once(ws,'open');
  const pending=new Map();
  const browserErrors=[];
  let next=0;
  ws.addEventListener('message',message=>{
    const {id,error,result,method,params}=JSON.parse(message.data);
    if(method==='Runtime.exceptionThrown') browserErrors.push(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text);
    if (method==="Runtime.consoleAPICalled" && params.type==="error") {
      browserErrors.push(params.args.map(arg=>arg.value ?? arg.description).join(" "));
    }
    if (!pending.has(id)) return;
    const {resolve,reject}=pending.get(id);
    pending.delete(id);
    error?reject(new Error(error.message)):resolve(result);
  });
  function call(method,params={}) {
    const id=++next;
    return new Promise((resolve,reject)=>{
      pending.set(id,{resolve,reject});
      ws.send(JSON.stringify({id,method,params}));
    });
  }
  async function evaluate(expression) {
    const {result,exceptionDetails}=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
    if (exceptionDetails) throw new Error(exceptionDetails.text);
    return result.value;
  }
  async function loaded(view) {
    await call('Page.navigate',{url:base+'/?qa&view='+view});
    let status;
    for (let tries=0;tries<600;tries++) {
      status=await evaluate('document.querySelector("#status")?.textContent');
      if(browserErrors.length) throw new Error(browserErrors.join('\n'));
      if (status==='Click Enter terrain to walk') {
        await wait(300);
        return;
      }
      if (status?.startsWith('Could not')) break;
      await wait(200);
    }
    throw new Error('Terrain page did not load: '+status+' '+await evaluate('JSON.stringify(performance.getEntries().filter(x=>x.entryType==="resource").map(x=>({url:x.name,ms:x.duration})))'));
  }
  async function capture(view) {
    if (browserErrors.length) throw new Error(browserErrors.join('\n'));
    const {data}=await call('Page.captureScreenshot',{format:'png'});
    await writeFile('screenshots/'+view+'.png',Buffer.from(data,'base64'));
    console.log(view+'.png');
  }
  await call('Runtime.enable');
  if(!process.argv.includes('--mobile-only')) {
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await loaded('');
  await evaluate('hud.enterMap()');
  await wait(1800);
  for(const key of ['traffic','topo','minerals','thermal']) {
    await evaluate(`hud.setLayer('${key}',true)`);
    await wait(900);
    const result=await evaluate(`({layer:hud.state.layer,text:document.querySelector('#hudLegend').textContent,image:document.querySelector('.mini .orbital-map img') ? document.querySelector('.mini .orbital-map img').complete && document.querySelector('.mini .orbital-map img').naturalWidth===256 : true})`);
    if(result.layer!==key || !result.image || !result.text.length) throw new Error('Layer failed '+key);
    await capture('overlay-'+key);
  }
  if(await evaluate('!!document.querySelector("#hudLegend input")'))throw new Error('Opacity controls remain');
  if(!await evaluate('document.querySelector("[data-menu=hudLayers]").textContent==="Overlays"'))throw new Error('Overlay label missing');
  await evaluate('hud.setLayer(null,false)');
  for(let tries=0;tries<80 && await evaluate('hud.state.layer!==null');tries++) await wait(200);
  if(await evaluate('hud.state.layer!==null'))throw new Error('Clear failed');
  }
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await loaded('');
  await evaluate('hud.enterMap()');await wait(1800);
  await evaluate("hud.setLayer('thermal',true)");await wait(600);
  const overflow=await evaluate("document.documentElement.scrollWidth>innerWidth");
  if(overflow)throw new Error('Narrow viewport overflow');
  await capture('overlay-mobile');
  await evaluate('weather.set({dust:1,event:"sep"});weather.setOpen(true)');
  if(await evaluate('!!document.querySelector(".weather-panel")'))throw new Error('Floating weather panel remains');
  if(!await evaluate('document.querySelector(".weather-alert").textContent.includes("SIMULATED EVA DANGER")'))throw new Error('Persistent warning missing');
  if(await evaluate('document.querySelectorAll("#weather-menu details").length')!==5)throw new Error('Weather subsections missing');
  await capture('weather-mobile-menu');
  await evaluate('weather.setOpen(false)');
  await capture('weather-mobile');
  console.log(process.argv.includes('--mobile-only') ? 'Mobile layout passed' : 'Four layers, images, fixed opacity, clearing and mobile width passed');
} finally {ws?.close();browser?.kill();server.kill();}
