import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {makeGround} from './ground.mjs';
import {PNG} from 'pngjs';
import {once} from 'node:events';

const chrome = process.argv[2] || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 18831, debugging = 18832;
const base = 'http://127.0.0.1:'+port;
const server = spawn(process.execPath,['serve.mjs',String(port)],{stdio:['ignore','pipe','inherit'],windowsHide:true});
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
let browser, ws;
try {
  await once(server.stdout,'data');
  await mkdir('screenshots',{recursive:true});
  browser = spawn(chrome,[
    '--headless=new','--no-first-run','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port='+debugging,'--user-data-dir='+resolve('.qa-chrome-'+process.pid),
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
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:850,deviceScaleFactor:1,mobile:false});
  await loaded('survey');
  await capture('survey');
  await loaded('return');
  await capture('return');
  await loaded('expanded');
  await capture('expanded');
  await loaded('spawn');
  await capture('spawn');

  const mouse=(type,x,y,props={})=>call('Input.dispatchMouseEvent',{type,x,y,...props});
  const key=(type,letter)=>call('Input.dispatchKeyEvent',{type,code:'Key'+letter,key:letter.toLowerCase()});
  const route=JSON.parse(await readFile('route.json','utf8'));
  await call('Page.bringToFront');
  await call('Emulation.setFocusEmulationEnabled',{enabled:true});
  const click=await evaluate('(()=>{const r=document.querySelector("#enter").getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()');
  await mouse('mousePressed',...click,{button:'left',clickCount:1});
  await mouse('mouseReleased',...click,{button:'left',clickCount:1});
  await wait(300);
  if (!(await evaluate('walkPose()')).locked) {
    await evaluate('document.querySelector("canvas").requestPointerLock().catch(() => {})');
    await wait(300);
  }
  const before=await evaluate('walkPose()');
  if (!before.locked) throw new Error('Chrome refused pointer lock');
  const turn=async (yaw,pitch) => {
    const angles=await evaluate('walkPose()');
    const x=(angles.yaw-yaw)/0.002, y=(angles.pitch-pitch)/0.002;
    await evaluate('document.dispatchEvent(new MouseEvent("mousemove",{movementX:'+x+',movementY:'+y+'}))');
  };
  const {spawn:origin,return:end}=route;
  const yaw=Math.atan2(origin.x-end.x,origin.z-end.z);
  await turn(yaw,-0.34);
  await key('keyDown','W');
  let after, progress=0;
  for (let tries=0;tries<140;tries++) {
    await wait(100);
    after=await evaluate('walkPose()');
    progress=Math.hypot(after.position[0]-origin.x,after.position[2]-origin.z);
    if (progress>=route.length-0.10) break;
  }
  await key('keyUp','W');
  const offset=Math.hypot(after.position[0]-end.x,after.position[2]-end.z);
  console.log({before,after,offset,progress});
  if (offset>0.45) throw new Error('WASD walk stopped before the return viewpoint');
  const meta=JSON.parse(await readFile('terrain.json','utf8'));
  const ground=makeGround(meta,Uint8Array.from(await readFile('ground.bin')).buffer);
  const targetY=ground.sample(end.targetX,end.targetZ).height;
  await turn(Math.atan2(after.position[0]-end.targetX,after.position[2]-end.targetZ),
    Math.atan2(targetY-after.position[1],Math.hypot(after.position[0]-end.targetX,after.position[2]-end.targetZ)));
  await wait(300);
  await capture('walked-return');
  const destination=route.expansion.end;
  const expansionYaw=Math.atan2(after.position[0]-destination.x,after.position[2]-destination.z);
  await turn(expansionYaw,-0.14);
  await key('keyDown','W');
  let expanded=after;
  const remaining=pose=>Math.hypot(pose.position[0]-destination.x,pose.position[2]-destination.z);
  for (let tries=0;tries<500 && remaining(expanded)>0.28;tries++) {
    await wait(100);
    expanded=await evaluate('walkPose()');
  }
  await key('keyUp','W');
  if (remaining(expanded)>0.40) {
    console.log({target:destination,actual:expanded.position,remaining:remaining(expanded)});
    throw new Error('WASD walk stopped before the expanded terrain viewpoint');
  }
  const expandedWalk=Math.hypot(expanded.position[0]-after.position[0],expanded.position[2]-after.position[2]);
  console.log({expandedWalk,expanded:expanded.position,destinationOffset:remaining(expanded)});
  await turn(Math.atan2(expanded.position[0]-end.x,expanded.position[2]-end.z),-0.16);
  await wait(300);
  await capture('walked-expanded');
  // The continued walk must stop where the terrain or clearance runs out.
  const [edgeX,,edgeZ]=expanded.position;
  const [extentX,extentZ]=meta.boundsMeters;
  const [edgeDistance,edgeHeading]=[[edgeX,Math.PI/2],[extentX-edgeX,-Math.PI/2],
    [edgeZ,0],[extentZ-edgeZ,Math.PI]].sort((a,b)=>a[0]-b[0])[0];
  await turn(edgeHeading,0);
  await key('keyDown','W');
  await wait(Math.max(2800,edgeDistance*2200+1600));
  const edge=await evaluate('walkPose()');
  await wait(1000);
  const stopped=await evaluate('walkPose()');
  await key('keyUp','W');
  if (Math.hypot(stopped.position[0]-edge.position[0],stopped.position[2]-edge.position[2])>0.04 ||
      !Number.isFinite(ground.foot(stopped.position[0],stopped.position[2]))) {
    throw new Error('Ground boundary did not stop movement');
  }
  console.log({edge:stopped.position});
  await key('keyDown','R');
  await key('keyUp','R');
  const reset=await evaluate('walkPose()');
  if (Math.hypot(reset.position[0]-origin.x,reset.position[2]-origin.z)>0.001) throw new Error('Reset failed');
  const coverage=PNG.sync.read(await readFile('terrain-coverage.png'));
  // This cross-slope walk passes through several fully inferred regions.
  const filledTarget=route.infill.end;
  const direction=Math.atan2(filledTarget.z-origin.z,filledTarget.x-origin.x);
  await turn(Math.atan2(-Math.cos(direction),-Math.sin(direction)),-0.26);
  await key('keyDown','W');
  let filledFrames=0, filledWalk=0;
  for (let i=0;i<410;i++) {
    await wait(100);
    const [x,y,z]=(await evaluate('walkPose()')).position;
    const height=ground.foot(x,z);
    if (!Number.isFinite(height) || Math.abs(y-height-1.65)>0.001) {
      throw new Error('Camera lost ground contact on the filled terrain');
    }
    const pixel=(Math.floor(z/meta.step)*coverage.width+Math.floor(x/meta.step))*4;
    if (coverage.data[pixel]===103) filledFrames++;
    filledWalk=Math.hypot(x-origin.x,z-origin.z);
    if (filledWalk>=route.infill.length-0.28) break;
  }
  await key('keyUp','W');
  if (filledWalk<route.infill.length-0.4 || filledFrames<5) {
    console.log({filledWalk,filledFrames,goal:route.infill.length,actual:await evaluate('walkPose()')});
    throw new Error('Did not cross the inferred ground');
  }
  console.log({filledWalk,filledFrames});
  await turn(Math.atan2(Math.cos(direction),Math.sin(direction)), -0.52);
  await wait(250);
  await capture('walked-infill');
  console.log('Pointer lock, slab route, expansion walk, ground boundary, reset and inferred-ground crossing passed');
} finally {
  ws?.close();
  browser?.kill();
  server.kill();
}
