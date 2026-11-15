import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {makeGround} from './ground.mjs';
import {buildApron} from './apron.mjs';
import {PNG} from 'pngjs';
import {once} from 'node:events';

const chrome = process.argv.slice(2).find(arg=>!arg.startsWith('--')) || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 18861, debugging = 18862;
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
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
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
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.voiceLog=[];window.voiceStarts=0;window.voiceFail=false;
    window.SpeechRecognition=class {
      start(){if(window.voiceFail)throw new Error('test start failure');window.voiceStarts++;this.onstart?.();}
      abort(){this.onend?.();}
      stop(){this.onend?.();}
    };
    Object.defineProperty(window,'speechSynthesis',{value:{cancel(){},speak(u){voiceLog.push(u.text);setTimeout(()=>u.onend?.(),20);}}});
  `});
  await loaded('');
  await evaluate('qaSky("day")');
  if(!await evaluate('hud.roxy.enabled && hud.roxy.running'))throw new Error('Roxy must start enabled');
  await evaluate('document.querySelector("#hudEar").click()');
  if(!await evaluate('!hud.roxy.enabled'))throw new Error('Microphone toggle must allow turning voice off');
  await evaluate('document.querySelector("#hudEar").click()');
  if(!await evaluate('hud.roxy.enabled && hud.roxy.running'))throw new Error('Explicit microphone activation failed');
  await evaluate(`hud.roxy.recogniser.onresult({resultIndex:0,results:[Object.assign([{transcript:'Roxy'}],{isFinal:true})]})`);await wait(500);
  if(!await evaluate('voiceLog.length===0 && hud.roxy.running && hud.roxy.armed'))throw new Error('Wake must silently arm recognition');
  await evaluate('hud.hear("open the overlay tab",true)');await wait(500);
  if(!await evaluate('document.querySelector("#hudLayers").classList.contains("open") && hud.roxy.armed'))throw new Error('Voice menu conversation failed');
  await evaluate('hud.hear("go to trafficability",true)');await wait(500);
  if(!await evaluate('hud.state.layer==="traffic" && voiceLog.some(x=>x.startsWith("Showing Trafficability"))'))throw new Error('Direct overlay command failed');
  await evaluate('document.querySelector("#hudEar").click();window.voiceFail=true;document.querySelector("#hudEar").click()');
  if(!await evaluate('!hud.roxy.enabled && !hud.roxy.running && document.querySelector("#hudEar").textContent.includes("could not start")'))throw new Error('Start failure not visible');
  await evaluate('window.voiceFail=false;document.querySelector("#hudEar").click();hud.roxy.recogniser.onerror({error:"not-allowed"})');
  if(!await evaluate('!hud.roxy.enabled && document.querySelector("#hudEar").textContent.includes("Mic blocked")'))throw new Error('Permission failure not visible');
  await evaluate('document.querySelector("#hudEar").click();hud.roxy.recogniser.onerror({error:"audio-capture"})');
  if(!await evaluate('!hud.roxy.enabled && document.querySelector("#hudEar").textContent.includes("No microphone")'))throw new Error('Missing mic failure not visible');
  await evaluate('document.querySelector("#hudEar").click();hud.setLayer(null,false);hud.setDockOpen(false)');
  console.log('Mock speech: default-on, off toggle, silent wake, menu follow-up, direct overlay, startup and permission errors passed');
  if(!await evaluate('document.querySelector("#hudDockItems").inert'))throw new Error('Dock must start collapsed');
  
  await evaluate('document.querySelector("#hudLauncher").click()');await wait(600);
  if(!await evaluate('document.querySelector("#hudLauncher").getAttribute("aria-expanded")==="true"'))throw new Error('Launcher click failed');
  await evaluate('document.querySelector("#hudLauncher").click();hud.hear("Roxy",true)');await wait(600);
  if(!await evaluate('document.querySelector(".dock").classList.contains("expanded") && !document.querySelector("#hudDockItems").inert'))throw new Error('Roxy wake did not open dock');
  if(!process.argv.includes('--mobile-only'))await capture('hud-eva-desktop');
  for(const layer of ['minerals','thermal']) {
    await evaluate(`hud.setLayer('${layer}',true)`);await wait(800);
    if(!await evaluate('document.querySelector(".mini").classList.contains("regional") && getComputedStyle(document.querySelector(".mini")).borderRadius==="14px"'))throw new Error('Regional map corners are not rounded');
    
  }
  await evaluate('weather.setOpen(true);hud.setDockOpen(false)');
  if(!await evaluate('document.querySelector("#weather-menu").hidden'))throw new Error('Dock collapse left menu open');
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await loaded('');
  await evaluate('qaSky("day");hud.hear("Roxy",true);weather.set({dust:0,event:"sep"});hud.setLayer("thermal",true)');await wait(1000);
  const layout=await evaluate('({overflow:document.documentElement.scrollWidth>innerWidth,alpha:getComputedStyle(document.querySelector(".weather-alert")).backgroundColor,dock:document.querySelector(".dock-items").getBoundingClientRect().toJSON()})');
  if(layout.overflow || layout.dock.x<0 || layout.dock.right>390)throw new Error('Mobile controls overflow');
  if(!await evaluate('document.querySelector(".suit").getBoundingClientRect().right < document.querySelector(".roxy").getBoundingClientRect().left'))throw new Error('Roxy text overlaps EVA readings');
  console.log(JSON.stringify(layout));
  await capture('hud-eva-mobile');
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  if(await evaluate('getComputedStyle(document.querySelector(".dock-items")).transitionDuration')!=='0s')throw new Error('Reduced-motion preference ignored');
  console.log('Click, Roxy wake, collapse, rounded maps, mobile layout and reduced-motion checks passed');
} finally {ws?.close();browser?.kill();server.kill();}
