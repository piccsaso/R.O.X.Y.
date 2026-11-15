import * as THREE from 'three';

const css = `
#hud .weather-menu{position:absolute;bottom:52px;right:0;width:310px;max-height:60dvh;overflow:auto;padding:6px;background:#162c268c;border:1px solid #9aa9bb80;border-radius:18px;backdrop-filter:blur(5px);pointer-events:auto;font:12px/1.5 "Segoe UI",sans-serif;letter-spacing:0;text-transform:none;text-shadow:0 1px 3px #000}
#hud .weather-menu[hidden]{display:none}
#hud .weather-menu details{padding:4px;border-bottom:1px solid #ffffff25}
#hud .weather-menu summary{cursor:pointer;padding:9px;color:#f4efe6;font-weight:600}
#hud .weather-menu label{display:block;margin:5px 8px}
#hud .weather-menu small{display:block;margin:5px 8px;color:#dce5f0;font-size:11px;line-height:1.4}
#hud .weather-menu select{display:block;width:calc(100% - 16px);margin:6px 8px;padding:7px;background:#293546;color:white;border:1px solid #8c9db2;font:inherit}
#hud .weather-menu button{display:block;width:100%;padding:9px;text-align:left;font-size:11px;letter-spacing:.02em}
#hud .weather-menu button[aria-pressed=true]{background:#f4efe6;color:#17110d}
#hud .weather-menu button:disabled{opacity:.5;cursor:default}
#hud .weather-menu :focus-visible{outline:2px solid #ffb454;outline-offset:-2px}
#hud .weather-alert{position:absolute;left:50%;bottom:90px;transform:translateX(-50%);width:max-content;max-width:min(700px,calc(100vw - 36px));padding:9px 14px;background:#241e14ed;color:#ffe8bd;border:1px solid #ffb454;font:600 13px/1.45 "Segoe UI",sans-serif;letter-spacing:.01em;text-transform:none;z-index:5;text-shadow:none}
#hud .weather-alert[data-severity=danger]{background:#6e21194d;color:#fff0ec;border-color:#ff9b8e99}
#hud .weather-alert[data-severity=context]{background:#192b3b40;color:#dbedff;border-color:#8fc4ef80}
#hud .weather-alert{top:168px;bottom:auto;max-width:calc(100vw - 520px);background:#392c1640;border-radius:16px;border-color:#ffb45480;text-shadow:0 1px 3px #000,0 0 2px #000}
#hud .weather-alert:empty{display:none}
#weather-noise{position:fixed;inset:0;width:100vw;height:100dvh;pointer-events:none;z-index:1}
@media(max-width:700px){#hud .weather-menu{width:min(310px,calc(100vw - 24px));max-height:40dvh}#hud .weather-alert{top:255px;bottom:auto;width:calc(100vw - 32px);max-width:none;max-height:145px;overflow:auto;font-size:11px}#hud .dock button{padding:12px 6px}}
`;

export function createWeather({scene,camera,lighting,hud}) {
  const root=document.getElementById('hud');
  if(!root) return {active:false,update(){}};
  document.head.appendChild(Object.assign(document.createElement('style'),{textContent:css}));
  const wrapper=Object.assign(document.createElement('div'),{className:'wrap'});
  const menu=Object.assign(document.createElement('nav'),{className:'weather-menu',id:'weather-menu',hidden:true});
  menu.setAttribute('aria-label','Weather scenarios');
  menu.innerHTML=`<details><summary>Dust storms</summary><button data-dust="0">Clear atmosphere</button><button data-dust="1">Dust storm</button><button data-dust="2">Severe dust storm</button></details>`;
  const categories=[['flare','Solar flares'],['cme','Coronal mass ejections'],['sep','Solar energetic particles'],['gst','Geomagnetic storms · Earth']];
  for(const [key,label] of categories) {
    const section=document.createElement('details');
    section.innerHTML=`<summary>${label}</summary><label for="weather-record-${key}">Historical record · May 2024</label><select id="weather-record-${key}" data-record="${key}" aria-label="${label} record" disabled><option>Loading catalog…</option></select><button data-event="${key}" ${key==='sep'?'':'disabled'}>${key==='sep'?'Activate Mars particle scenario':'Activate scenario'}</button>`;
    if(key==='sep')section.insertAdjacentHTML('beforeend','<small>Illustrative Mars scenario. The selected DONKI record does not establish Mars exposure.</small>');
    menu.appendChild(section);
  }
  menu.insertAdjacentHTML('beforeend','<button data-event="none">Clear solar event</button><button id="weather-clear">Clear all weather</button>');
  const button=Object.assign(document.createElement('button'),{textContent:'Weather',type:'button'});
  button.setAttribute('aria-controls',menu.id);button.setAttribute('aria-expanded','false');
  wrapper.append(menu,button);root.querySelector('.dock-items').appendChild(wrapper);
  const alert=Object.assign(document.createElement('div'),{className:'weather-alert'});
  alert.setAttribute('role','alert');root.appendChild(alert);
  const noise=document.createElement('canvas');noise.id='weather-noise';noise.width=640;noise.height=360;
  document.body.appendChild(noise);const noiseContext=noise.getContext('2d');
  const state={dust:0,event:'none',catalog:null,error:null};
  let seed=7419;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const positions=new Float32Array(1600*3);
  for(let i=0;i<positions.length;i+=3){positions[i]=random()*32-16;positions[i+1]=random()*10-3;positions[i+2]=random()*32-16;}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const material=new THREE.PointsMaterial({color:'#d2a77d',size:.045,transparent:true,opacity:.3,depthWrite:false});
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(0.15, 0.5, length(gl_PointCoord - vec2(0.5)));');
  };
  const particles=new THREE.Points(geometry,material);particles.frustumCulled=false;particles.visible=false;scene.add(particles);
  const fogDefault={near:scene.fog.near,far:scene.fog.far};
  let elapsed=0,lastNoise=0;
  function setOpen(open) {
    if(open)hud.setDockOpen(true);
    menu.hidden=!open;
    button.setAttribute('aria-expanded',String(open));
    button.classList.toggle('open',open);
  }
  button.onclick=event=>{
    event.stopPropagation();
    const open=menu.hidden;
    for(const other of root.querySelectorAll('.menu')) other.classList.remove('open');
    for(const other of root.querySelectorAll('[data-menu]')) {other.classList.remove('open');other.setAttribute('aria-expanded','false');}
    setOpen(open);
  };
  menu.addEventListener('click',event=>event.stopPropagation());
  for(const other of root.querySelectorAll('[data-menu]'))other.addEventListener('click',()=>setOpen(false));
  document.addEventListener('click',()=>setOpen(false));
  root.addEventListener('dockcollapse',()=>setOpen(false));
  document.addEventListener('keydown',event=>{if(event.key==='Escape')setOpen(false);});
  function records(key=state.event) {
    const data=state.catalog;
    return data ? ({cme:data.cmes,sep:data.sep,gst:data.gst,flare:data.flares}[key]||[]) : [];
  }
  function warn() {
    const selector=menu.querySelector(`[data-record="${state.event}"]`);
    const record=records()[Number(selector?.value || 0)];
    const messages=[];
    if(state.event==='sep')messages.push('SIMULATED EVA DANGER — illustrative Mars particle exposure. Suspend EVA and seek designated shelter. Suit shielding unverified.');
    if(state.event==='cme')messages.push(`SIMULATED EVA CAUTION — CME. ${record?'ENLIL predicted Mars arrival '+record.arrival+'. ':''}Assess radiation before EVA; suit damage unassessed.`);
    if(state.event==='flare')messages.push(`SIMULATED EVA CAUTION — solar flare${record?' '+record.class:''}. Verify Mars exposure before EVA; suit damage unassessed.`);
    if(state.event==='gst')messages.push(`EARTH GEOMAGNETIC ALERT${record?' · Kp '+record.kp:''}. Mars exposure and suit risk unassessed.`);
    if(state.dust)messages.push(state.dust===2?'SIMULATED DUST DANGER — low visibility; suspend traverse.':'SIMULATED DUST CAUTION — reduced visibility.');
    if(state.error)messages.push(state.error);
    alert.textContent=messages.join(' ');
    alert.dataset.severity=state.event==='sep'||state.dust===2?'danger':state.event==='gst'&&!state.dust?'context':'caution';
  }
  function apply() {
    const sep=state.event==='sep';
    hud.setWeather({dust:state.dust,particles:sep});
    if(state.dust || sep)hud.setLayer('traffic',true);
    if(!sep)noiseContext.clearRect(0,0,noise.width,noise.height);
    for(const control of menu.querySelectorAll('[data-dust]'))control.setAttribute('aria-pressed',String(Number(control.dataset.dust)===state.dust));
    for(const control of menu.querySelectorAll('[data-event]'))control.setAttribute('aria-pressed',String(control.dataset.event===state.event));
    warn();
  }
  for(const control of menu.querySelectorAll('[data-dust]'))control.onclick=()=>{state.dust=Number(control.dataset.dust);apply();setOpen(false);};
  for(const control of menu.querySelectorAll('[data-event]'))control.onclick=()=>{state.event=control.dataset.event;apply();setOpen(false);};
  for(const selector of menu.querySelectorAll('[data-record]'))selector.onchange=()=>{if(state.event===selector.dataset.record)warn();};
  function clear(){state.dust=0;state.event='none';apply();setOpen(false);}
  menu.querySelector('#weather-clear').onclick=clear;
  fetch('weather-data/summary.json').then(response=>{
    if(!response.ok)throw new Error('Catalog unavailable');
    return response.json();
  }).then(data=>{
    state.catalog=data;
    for(const [key] of categories) {
      const selector=menu.querySelector(`[data-record="${key}"]`);
      selector.replaceChildren();
      for(const [index,record] of records(key).entries())selector.add(new Option(record.id+(key==='sep'?' · '+record.instruments.join(', '):''),String(index)));
      selector.disabled=selector.options.length===0;
      menu.querySelector(`[data-event="${key}"]`).disabled=key!=='sep' && selector.disabled;
      if(selector.disabled)selector.add(new Option('No archived records',''));
    }
    apply();
  }).catch(()=>{
    state.error='Archive unavailable; solar-event assessment incomplete.';
    for(const selector of menu.querySelectorAll('[data-record]'))selector.replaceChildren(new Option('Archive unavailable',''));
    warn();
  });
  return {state,clear,setOpen,
    set({dust=state.dust,event=state.event}) {
      if(![0,1,2].includes(dust) || !['none','cme','sep','gst','flare'].includes(event))return;
      state.dust=dust;state.event=event;apply();
    },
    get active(){return state.dust>0 || state.event==='sep';},
    update(dt) {
      elapsed+=dt;
      const dust=state.dust;
      scene.fog.near=dust ? (dust===2?1:7) : hud.state.mapMode?140:fogDefault.near;
      scene.fog.far=dust ? (dust===2?25:65) : hud.state.mapMode?420:fogDefault.far;
      lighting.sunTint.value.multiplyScalar(dust===2?.18:dust===1?.6:1);
      lighting.ambientTint.value.multiplyScalar(dust===2?.55:dust===1?.85:1);
      particles.visible=dust>0;particles.position.copy(camera.position);
      if(dust) {
        for(let i=0;i<positions.length;i+=3){positions[i]=(positions[i]+16+dt*(2+dust*2))%32-16;positions[i+2]=(positions[i+2]+16+dt*.7)%32-16;}
        geometry.attributes.position.needsUpdate=true;
      }
      if(state.event==='sep' && elapsed-lastNoise>.1) {
        lastNoise=elapsed;noiseContext.clearRect(0,0,640,360);noiseContext.fillStyle='#ffffffb0';
        for(let i=0;i<35;i++)noiseContext.fillRect(random()*640,random()*360,random()*3+1,1);
      }
    }
  };
}
