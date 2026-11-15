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
  await call('Emulation.setDeviceMetricsOverride',{width:process.env.QA_FAST==='1'?960:1280,height:process.env.QA_FAST==='1'?640:850,deviceScaleFactor:1,mobile:false});
  if(process.env.SKY_CHECKS_ONLY!=='1') {
  await loaded('survey');
  await capture('survey');
  await loaded('lower');
  await capture('lower');
  await loaded('return');
  await capture('return');
  await loaded('expanded');
  await capture('expanded');
  await loaded('spawn');
  await capture('spawn');
  for(const preset of ['day','sunset','night']) {
    await evaluate('qaSky('+JSON.stringify(preset)+')');
    const state=await evaluate('skyState()');const s=state.sun;
    await evaluate('qaAim('+(preset==='night'?0:Math.atan2(-s[0],-s[2]))+','+(preset==='night'?0.55:0.12)+')');
    await wait(800);await capture('sky-'+preset);
  }
  await evaluate('qaAim(0,-0.35)');await wait(500);await capture('night-no-light');
  await evaluate('qaLamp()');await wait(500);await capture('night-exploration-light');
  } else {await loaded('spawn');await evaluate('qaSky("night")');}

  await call('Page.bringToFront');
  await call('Emulation.setFocusEmulationEnabled',{enabled:true});
  await evaluate('document.querySelector("canvas").requestPointerLock()');
  await wait(400);
  if(!(await evaluate('walkPose()')).locked)throw new Error('Pointer lock unavailable for speed checks');
  const speeds={};
  for(const sprint of [false,true]) {
    await evaluate('qaPosition(28,35);qaAim(0,-0.2)');
    const before=await evaluate('walkPose()');
    if(sprint)await call('Input.dispatchKeyEvent',{type:'keyDown',code:'ShiftLeft',key:'Shift'});
    await call('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyW',key:'w'});
    for(let tries=0;tries<100;tries++) {
      await wait(100);
      if((await evaluate('walkPose()')).movingTime-before.movingTime>0.7)break;
    }
    await call('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w'});
    if(sprint)await call('Input.dispatchKeyEvent',{type:'keyUp',code:'ShiftLeft',key:'Shift'});
    const after=await evaluate('walkPose()');
    const speed=Math.hypot(after.position[0]-before.position[0],after.position[2]-before.position[2])/(after.movingTime-before.movingTime);
    if(!Number.isFinite(speed)||Math.abs(speed-(sprint?5:2.6))>0.01)throw new Error('Movement speed mismatch: '+speed);
    speeds[sprint?'sprint':'walk']=speed;
  }
  await evaluate('document.querySelector("#pause-sky").click()');
  await wait(1500);
  const beforeSky=await evaluate('skyState()');await wait(2500);
  const afterSky=await evaluate('skyState()');
  await evaluate('document.querySelector("#pause-sky").click()');
  const cycleSeconds=(afterSky.frameTime-beforeSky.frameTime)/1000/(afterSky.fraction-beforeSky.fraction);
  if(!Number.isFinite(cycleSeconds)||Math.abs(cycleSeconds-480)>80)throw new Error('Cycle timing mismatch '+cycleSeconds);
  await writeFile('screenshots/sky-verification.json',JSON.stringify({speeds,cycleSeconds,browserErrors},null,2)+'\n');
  console.log({speeds,cycleSeconds,browserErrors});
} finally {ws?.close();browser?.kill();server.kill();}
