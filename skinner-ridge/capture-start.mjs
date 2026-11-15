import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {makeGround} from './ground.mjs';
import {buildApron} from './apron.mjs';
import {PNG} from 'pngjs';
import {once} from 'node:events';

const chrome = process.argv[2] || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
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
    for (let tries=0;tries<100;tries++) {
      status=await evaluate('document.querySelector("#status")?.textContent');
      if (status==='Click Enter terrain to walk') {
        await wait(300);
        return;
      }
      if (status?.startsWith('Could not')) break;
      await wait(200);
    }
    throw new Error('Terrain page did not load: '+status);
  }
  async function capture(view) {
    if (browserErrors.length) throw new Error(browserErrors.join('\n'));
    const {data}=await call('Page.captureScreenshot',{format:'png'});
    await writeFile('screenshots/'+view+'.png',Buffer.from(data,'base64'));
    console.log(view+'.png');
  }
  await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1917,height:873,deviceScaleFactor:1,mobile:false});
  await loaded('');
  const initial=await evaluate('walkPose()');
  const route=JSON.parse(await readFile('route.json','utf8'));
  const meta=JSON.parse(await readFile('terrain.json','utf8'));
  const core=makeGround(meta,Uint8Array.from(await readFile('ground.bin')).buffer);
  const apron=buildApron(core,meta);
  const height=(x,z)=>(core.sample(x,z)||apron.sample(x,z))?.height;
  function check(pose) {
    if(Math.hypot(pose.position[0]-route.start.x,pose.position[2]-route.start.z)>1e-6 ||
       Math.abs(pose.position[1]-height(route.start.x,route.start.z)-1.65)>1e-6 ||
       Math.abs(pose.yaw-route.start.yaw)>1e-6 || Math.abs(pose.pitch-route.start.pitch)>1e-6)throw new Error('Start/reset mismatch');
  }
  check(initial);
  await evaluate('qaPosition(28,10);qaAim(0,-0.3);document.querySelector("#reset").click()');
  check(await evaluate('walkPose()'));
  await evaluate('qaPosition(26,11);qaAim(0,-0.2)');
  await call('Page.bringToFront');
  await call('Emulation.setFocusEmulationEnabled',{enabled:true});
  await evaluate('document.querySelector("canvas").requestPointerLock()');
  await wait(400);
  if(!(await evaluate('walkPose().locked')))throw new Error('Pointer lock failed');
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'r',code:'KeyR',windowsVirtualKeyCode:82});
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:'r',code:'KeyR',windowsVirtualKeyCode:82});
  check(await evaluate('walkPose()'));
  for(let z=-2;z<=10;z+=0.05)if(!Number.isFinite(height(30,z)))throw new Error('Start approach has a hole');
  await evaluate('document.body.classList.add("locked")');
  await wait(1200);await capture('opening-view');
  if(browserErrors.length)throw new Error(browserErrors.join('\n'));
  await writeFile('screenshots/start-verification.json',JSON.stringify({initial,buttonReset:true,keyboardReset:true,groundContact:true,approachToCore:true,browserErrors},null,2)+'\n');
  console.log('Opening pose, both resets, and approach passed');
} finally {ws?.close();browser?.kill();server.kill();}
