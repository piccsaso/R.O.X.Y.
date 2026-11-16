// This code was assisted through the use of SI.
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
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await loaded('');
  for(let i=0;i<60 && !await evaluate('!!weather.state.catalog');i++)await wait(200);
  if(!await evaluate('!!weather.state.catalog'))throw new Error('Weather catalog missing');
  await evaluate('qaSky("day");document.querySelector("[aria-controls=weather-menu]").click()');
  for(const scenario of [{dust:2,event:'none'},{dust:0,event:'cme'},{dust:0,event:'sep'},{dust:0,event:'gst'},{dust:0,event:'flare'}]) {
    await evaluate(`weather.setOpen(true);document.querySelector('[data-dust="${scenario.dust}"]').click();weather.setOpen(true);document.querySelector('[data-event="${scenario.event}"]').click();`);await wait(1200);
    const check=await evaluate('({dust:weather.state.dust,event:weather.state.event,text:document.querySelector(".weather-alert").textContent,closed:document.querySelector("#weather-menu").hidden})');
    if(check.dust!==scenario.dust || check.event!==scenario.event || !check.closed)throw new Error('Scenario or auto-close mismatch');
    if(!check.text)throw new Error('Warning missing');
    if(scenario.event==='gst' && !check.text.includes('EARTH GEOMAGNETIC ALERT'))throw new Error('Earth context lost');
    if(scenario.event==='sep' && !check.text.includes('SIMULATED EVA DANGER'))throw new Error('SEP warning missing');
    await capture('weather-'+(scenario.dust?'dust':scenario.event));
  }
  await evaluate('weather.clear()');await wait(700);
  if(await evaluate('weather.active || document.querySelector(".weather-alert").textContent.length>0'))throw new Error('Weather clear failed');
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await loaded('');
  await evaluate('qaSky("day");weather.set({dust:1,event:"sep"});weather.setOpen(true)');await wait(1000);
  if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw new Error('Mobile overflow');
  await capture('weather-mobile-menu');
  await evaluate('weather.setOpen(false)');
  await capture('weather-mobile');
  console.log('Dust, CME, SEP, Earth GST, flare, clearing and mobile checks passed');
} finally {ws?.close();browser?.kill();server.kill();}
