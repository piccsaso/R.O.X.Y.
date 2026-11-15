import {createSpeech} from './speech.mjs';
// Helmet HUD for the Skinner Ridge walk: compass, minimap, suit gauge,
// destination pin, route lines, return warning, planning view, voice.
import {makeNav, makeLandmarks, parseCommand, config} from './nav.mjs';

const INK = '#f4efe6', AMBER = '#ffb454', RED = '#ff3b30';
const ROUTE = {safe:'#8dff6a', straight:'#ff6a3d', custom:'#c79bff', home:'#ff3b30'};

const FONT = 'Bahnschrift,"DIN Alternate","Segoe UI",system-ui,sans-serif';
const GLASS = 'background:linear-gradient(180deg,#f4efe61f,#f4efe60a);border:1px solid #f4efe647;backdrop-filter:blur(10px) saturate(1.2);-webkit-backdrop-filter:blur(10px) saturate(1.2)';
const css = `
#hud{position:fixed;inset:0;pointer-events:none;z-index:2;color:${INK};font:600 12px/1.3 ${FONT};letter-spacing:.09em;text-transform:uppercase;text-shadow:0 1px 3px #000c}
#hud canvas{display:block;width:auto;height:auto}
#hud .vignette{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 46%,transparent 58%,#0007 100%)}
#hud .compass{position:absolute;top:12px;left:50%;transform:translateX(-50%);text-align:center}
#hud .bearing{display:inline-block;margin-top:-2px;padding:1px 9px 0;font-size:15px;border-bottom:2px solid ${AMBER}}
#hud .mini{position:absolute;top:18px;right:20px;border:1px solid #f4efe680;border-radius:3px;overflow:hidden;box-shadow:0 6px 22px #0007}
#hud .suit{position:absolute;left:20px;bottom:16px}
#hud .coords{margin:-4px 0 0 4px;font-size:10px;opacity:.85}
#hud .coords b{font-size:8px;opacity:.7;margin-left:6px;font-weight:600}
#hud .note{position:absolute;top:92px;left:50%;transform:translateX(-50%);font-size:15px;text-align:center;max-width:60vw;opacity:0;transition:opacity .4s}
#hud .note.on{opacity:1}
#hud .pin{position:absolute;transform:translate(-50%,-100%);padding-bottom:34px;white-space:nowrap;display:none;font-size:11px;letter-spacing:.14em;text-shadow:0 1px 4px #000,0 0 12px #0009}
#hud .pin b{font-size:24px;font-weight:700;letter-spacing:0;margin-right:3px}
#hud .pin em{font-style:normal;opacity:.5;margin:0 9px}
#hud .pin::after{content:"";position:absolute;left:50%;bottom:6px;height:24px;border-left:1px solid #fffd}
#hud .pin::before{content:"";position:absolute;left:50%;bottom:0;width:7px;height:7px;margin-left:-4px;background:${INK};transform:rotate(45deg)}
#hud .return{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);padding:14px 26px;font-size:24px;color:#fff;background:#b3140fd9;border:1px solid ${RED};border-radius:2px;display:none;transition:left .9s cubic-bezier(.6,0,.2,1),top .9s cubic-bezier(.6,0,.2,1),font-size .9s,padding .9s;animation:hudPulse 1s ease-in-out infinite;text-align:center}
#hud .return small{display:block;font-size:.55em;opacity:.9;margin-top:2px}
#hud .return.docked{left:132px;top:36%;font-size:13px;padding:8px 12px}
@keyframes hudPulse{0%,100%{box-shadow:0 0 0 0 #ff3b30cc}50%{box-shadow:0 0 34px 10px #ff3b3055}}
#hud .flash{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,#ff1e1e66 100%);opacity:0;transition:opacity .5s}
#hud .flash.on{opacity:1;animation:hudFlash 1s ease-in-out infinite}
@keyframes hudFlash{50%{opacity:.35}}
#hud .dock{position:absolute;left:50%;bottom:26px;transform:translateX(-50%);display:flex;gap:2px;pointer-events:auto;${GLASS};padding:3px;border-radius:3px}
#hud button,.sky-controls button{font:600 11px ${FONT};letter-spacing:.22em;color:${INK};background:none;border:0;border-radius:2px;padding:11px 26px 10px;cursor:pointer;text-transform:uppercase;position:relative;transition:background .15s,color .15s}
#hud button::after,.sky-controls button::after{content:"";position:absolute;left:26px;right:26px;bottom:5px;height:1px;background:${AMBER};transform:scaleX(0);transition:transform .2s}
#hud button:hover,.sky-controls button:hover{background:#f4efe61f}
#hud button:hover::after,#hud button.open::after,.sky-controls button:hover::after{transform:scaleX(1)}
#hud button.open{background:#f4efe6;color:#17110d;text-shadow:none}
#hud .menu{position:absolute;bottom:52px;left:-3px;min-width:230px;${GLASS};backdrop-filter:blur(14px) saturate(1.2);-webkit-backdrop-filter:blur(14px) saturate(1.2);border-radius:3px;padding:3px;display:none;box-shadow:0 8px 28px #0005;background:linear-gradient(180deg,#1c130e73,#1c130e59);white-space:nowrap}
#hud .menu.open{display:block}
#hud .menu div{display:flex;align-items:center;gap:12px;padding:11px 14px 10px;border-radius:2px;cursor:pointer;font-size:11px;letter-spacing:.22em;position:relative}
#hud .menu div::after{content:"";position:absolute;left:33px;right:14px;bottom:5px;height:1px;background:var(--tone,#ffb454);transform:scaleX(0);transform-origin:left;transition:transform .2s}
#hud .menu div.on::after{transform:scaleX(1)}
#hud .menu div:hover{background:#f4efe61f}
#hud .menu div.off{opacity:.4;cursor:default}
#hud .menu i{width:7px;height:7px;border:1px solid var(--tone,currentColor);transform:rotate(45deg);flex:none}
#hud .menu .on i{background:var(--tone,currentColor)}
#hud .wrap{position:relative}
#hud .legend{position:absolute;left:50%;top:120px;transform:translateX(-50%);font-size:10px;white-space:nowrap;display:none}
#hud .legend i{display:inline-block;width:9px;height:9px;margin:0 5px 0 14px;border-radius:1px}
#hud .roxy{position:absolute;left:50%;bottom:96px;transform:translateX(-50%);display:none;flex-direction:column;align-items:center;gap:10px}
#hud .roxy.on{display:flex}
#hud .roxy .orb{width:66px;height:66px;border-radius:50%;display:grid;place-items:center;background:#1c130ecc;border:1.5px solid ${AMBER};backdrop-filter:blur(8px);animation:roxyPulse 1.3s ease-in-out infinite}
#hud .roxy svg{width:30px;height:30px;fill:none;stroke:${INK};stroke-width:1.8;stroke-linecap:round}
#hud .roxy span{font-size:14px;text-transform:none;letter-spacing:.03em;min-height:18px}
#hud .roxy small{font-size:10px;letter-spacing:.3em;color:${INK}}
@keyframes roxyPulse{0%,100%{box-shadow:0 0 0 0 #ffb45499}50%{box-shadow:0 0 0 14px #ffb45400}}
#hud .ear{position:absolute;right:24px;top:240px;font-size:9px;letter-spacing:.24em;opacity:.75;display:none}
#hud .ear.on{display:block}
#hud .ear::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:${AMBER};margin-right:7px}
#hud .type{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);display:none;pointer-events:auto}
#hud .type input{font:500 16px ${FONT};width:min(460px,70vw);padding:11px 14px;color:#fff;${GLASS};background:#1c130ed9;border-radius:3px;outline:none}
#hud .credit{position:absolute;right:20px;bottom:8px;font-size:8px;opacity:.6;letter-spacing:.12em}
#hud .label{position:absolute;transform:translate(-50%,-100%);font:italic 15px Georgia,serif;text-transform:none;letter-spacing:0;padding-bottom:32px;pointer-events:auto;cursor:pointer;white-space:nowrap;display:none}
#hud .label::after{content:"";position:absolute;left:50%;bottom:0;height:28px;border-left:1px solid #fff}
#hud .label small{display:block;font:600 11px ${FONT};letter-spacing:.1em;text-transform:uppercase;text-align:center;opacity:.9}
body.locked #hud .dock{display:none}
header{left:22px!important;top:16px!important;right:auto!important;flex-direction:column;align-items:flex-start!important;gap:12px!important}
header .panel:first-child{background:none!important;border:0!important;padding:0!important}
header h1{font:600 15px ${FONT}!important;letter-spacing:.28em;text-transform:uppercase;margin:0!important;text-shadow:0 1px 3px #000c}
header small{font:600 9px ${FONT};letter-spacing:.3em;opacity:.7;text-transform:uppercase}
body.locked header{opacity:1!important}
body.locked .sky-controls,body.mapmode .sky-controls{display:none}
footer{display:none!important}
.sky-controls{${GLASS};background:linear-gradient(180deg,#f4efe61f,#f4efe60a)!important;border-radius:3px!important;padding:12px 14px 10px!important;width:250px;color:${INK};font:600 10px ${FONT};letter-spacing:.2em;text-transform:uppercase;text-shadow:0 1px 3px #000c}
.sky-controls label{display:block;margin:8px 0 2px;font-size:9px;opacity:.7}
.sky-controls small{display:block;font-size:9px!important;letter-spacing:.16em!important}
.sky-controls small:last-child{display:none}
.sky-controls .actions{gap:2px!important;margin:6px -8px 0}
.sky-controls button{padding:8px 12px 9px;font-size:10px;letter-spacing:.18em}
.sky-controls button::after{left:12px;right:12px;bottom:4px}
.sky-controls input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:18px;background:none;margin:0;pointer-events:auto;cursor:pointer}
.sky-controls input[type=range]::-webkit-slider-runnable-track{height:1px;background:#f4efe699}
.sky-controls input[type=range]::-moz-range-track{height:1px;background:#f4efe699}
.sky-controls input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:11px;height:11px;margin-top:-5px;background:${AMBER};border:0;transform:rotate(45deg);box-shadow:0 0 0 3px #ffb45433}
.sky-controls input[type=range]::-moz-range-thumb{width:10px;height:10px;background:${AMBER};border:0;border-radius:0;transform:rotate(45deg)}
#reticle{background:#fff!important;opacity:.7}
`;

const html = `
<div class="vignette"></div><div class="flash" id="hudFlash"></div>
<div class="compass"><canvas width="640" height="46"></canvas><span class="bearing" id="hudBearing">000</span></div>
<div class="mini"><canvas width="224" height="204"></canvas></div>
<div class="ear" id="hudEar">Say “Roxy”</div>
<div class="suit"><canvas width="250" height="236"></canvas><div class="coords" id="hudCoords"></div></div>
<div class="note" id="hudNote"></div>
<div class="pin" id="hudPin"></div>
<div class="return" id="hudReturn"></div>
<div class="legend" id="hudLegend"></div>
<div class="roxy" id="hudRoxy"><div class="orb"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg></div><small>Roxy listening</small><span id="hudHeard"></span></div>
<div class="type"><input id="hudCmd" placeholder="Type a command, then Enter" autocomplete="off"></div>
<div class="dock">
  <div class="wrap"><div class="menu" id="hudOptions"></div><button data-menu="hudOptions">Options</button></div>
  <div class="wrap"><div class="menu" id="hudRoutes"></div><button data-menu="hudRoutes">Routes</button></div>
  <button id="hudReset">Reset position</button>
</div>
<div class="credit">Terrain NASA/JPL-Caltech Navcam · includes inferred terrain · suit telemetry simulated</div>`;

const legends = {
  slope:'<i style="background:#ffe14d"></i>15–25° <i style="background:#ff9f0a"></i>25–35° <i style="background:#ff3b30"></i>over 35° · slope over 0.8 m, derived from the terrain',
  truth:'<i style="background:#7ddc6f"></i>rover-measured <i style="background:#ff9628"></i>inferred fill <i style="background:#9a98a8"></i>context terrain (not measured)'
};

export async function initHud(ctx) {
  const {THREE, scene, camera, renderer, canvas, ground, meta, route, materials, terrains, isLocked, enterButton, resetButton, lighting} = ctx;
  const [W, D] = meta.boundsMeters;
  const nav = makeNav(meta, ground);
  const [EX, EZ, EW, ED] = nav.extent;
  const landmarks = makeLandmarks(route);
  const base = landmarks.find(l => l.id==='base'), summit = landmarks.find(l => l.id==='summit');
  const heightAt = (x,z) => ground.sample(x,z)?.height ?? 0;

  // Measured versus inferred support, from the build's coverage map.
  let coverage = null;
  try {
    const image = new Image(); image.src = 'terrain-coverage.png'; await image.decode();
    const c = Object.assign(document.createElement('canvas'), {width:image.width, height:image.height});
    const g = c.getContext('2d', {willReadFrequently:true}); g.drawImage(image, 0, 0);
    coverage = {width:image.width, height:image.height, data:g.getImageData(0,0,image.width,image.height).data};
  } catch {}
  // 0 measured, 1 inferred, 2 context terrain beyond the patch.
  const support = (x,z) => {
    if (x<0 || z<0 || x>=W || z>=D || !coverage) return 2;
    const col = Math.min(coverage.width-1, Math.floor(x/meta.step)), row = Math.min(coverage.height-1, Math.floor(z/meta.step));
    return coverage.data[(row*coverage.width+col)*4]===103 ? 1 : 0;
  };

  document.head.appendChild(Object.assign(document.createElement('style'), {textContent:css}));
  const root = Object.assign(document.createElement('div'), {id:'hud', innerHTML:html});
  document.body.appendChild(root);
  const small = document.querySelector('header small'); if (small) small.textContent = 'Jezero Crater · Mars';
  const $ = id => root.querySelector('#'+id);
  const tape = root.querySelector('.compass canvas').getContext('2d');
  const mini = root.querySelector('.mini canvas').getContext('2d');
  const suit = root.querySelector('.suit canvas').getContext('2d');

  const state = {layer:null, mapMode:false, muted:false, show:{straight:true, safe:true, custom:false}, cleared:false,
    goal:summit, custom:null, routes:{}, o2:1, power:1, heart:74, temp:21.4, eva:0, warning:false, lastNote:''};
  let redraw = true, overlayFade = 0, overlayTarget = 0, overlayDirty = false, pendingClear = false;

  // ---- data highlight draped on the terrain ----
  const overlayCanvas = Object.assign(document.createElement('canvas'), {width:nav.cols, height:nav.rows});
  const overlayContext = overlayCanvas.getContext('2d');
  const overlayTexture = new THREE.CanvasTexture(overlayCanvas);
  Object.assign(overlayTexture, {flipY:false, colorSpace:THREE.SRGBColorSpace, generateMipmaps:false, minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter});
  const uniforms = {overlayMap:{value:overlayTexture}, overlayBox:{value:new THREE.Vector4(EX,EZ,EW,ED)}, overlayOpacity:{value:0}};
  for (const material of materials) {
    const earlier = material.onBeforeCompile;
    material.onBeforeCompile = (shader, r) => {
      earlier?.(shader, r);
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = 'varying vec2 vOverlayXZ;\n'+shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvOverlayXZ=(modelMatrix*vec4(position,1.0)).xz;');
      shader.fragmentShader = 'uniform sampler2D overlayMap;uniform vec4 overlayBox;uniform float overlayOpacity;varying vec2 vOverlayXZ;\n'+
        shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          vec4 ov=texture2D(overlayMap,(vOverlayXZ-overlayBox.xy)/overlayBox.zw);
          float lum=dot(diffuseColor.rgb,vec3(0.3333));
          diffuseColor.rgb=mix(diffuseColor.rgb*mix(1.0,0.7,overlayOpacity),ov.rgb*(0.22+1.25*lum),ov.a*overlayOpacity);`);
    };
    material.customProgramCacheKey = () => 'mars-light-hud';
    material.needsUpdate = true;
  }
  function paintOverlay() {
    overlayDirty = false;
    const image = overlayContext.createImageData(nav.cols, nav.rows), px = image.data;
    for (let i=0; i<nav.count; i++) {
      const [x,z] = nav.center(i);
      let c = null;
      if (state.layer==='slope') {
        // Slope over a 0.8 m walking baseline, so centimetre-scale texture does not read as cliffs.
        const gx = (heightAt(x+0.4,z)-heightAt(x-0.4,z))/0.8, gz = (heightAt(x,z+0.4)-heightAt(x,z-0.4))/0.8;
        const deg = Math.atan(Math.hypot(gx,gz))*180/Math.PI;
        c = deg>35 ? [255,59,48,215] : deg>25 ? [255,159,10,190] : deg>15 ? [255,225,77,140] : null;
      } else if (state.layer==='truth') c = [[125,220,111,140],[255,150,40,185],[154,152,168,120]][support(x,z)];
      if (c) px.set(c, i*4);
    }
    overlayContext.putImageData(image, 0, 0);
    overlayTexture.needsUpdate = true; redraw = true;
  }
  function setLayer(layer, on) {
    const next = on ? layer : (state.layer===layer || layer===null ? null : state.layer);
    if (next) { state.layer = next; overlayDirty = true; overlayTarget = 1; pendingClear = false; }
    else { overlayTarget = 0; pendingClear = true; }
    $('hudLegend').style.display = next ? 'block' : 'none';
    if (next) $('hudLegend').innerHTML = legends[next];
    buildMenus();
  }

  // ---- minimap base: the terrain rendered from above under neutral light ----
  const basePx = 9, baseMap = Object.assign(document.createElement('canvas'), {width:Math.round(EW*basePx), height:Math.round(ED*basePx)});
  {
    const target = new THREE.WebGLRenderTarget(baseMap.width, baseMap.height);
    const top = new THREE.OrthographicCamera(-EW/2, EW/2, ED/2, -ED/2, 0.1, 120);
    top.up.set(0,0,1); top.position.set(EX+EW/2, 34, EZ+ED/2); top.lookAt(EX+EW/2, 0, EZ+ED/2);
    const keep = new Set(terrains), restore = [];
    for (const child of scene.children) {
      const isContext = child.isMesh && child.material?.uniforms?.atlas0;
      if (!keep.has(child) && !isContext && child.visible) { child.visible = false; restore.push(child); }
    }
    const fog = scene.fog, saved = {a:lighting.ambientTint.value.clone(), s:lighting.sunTint.value.clone(), l:lighting.lampPower.value};
    scene.fog = null; lighting.ambientTint.value.setRGB(1,1,1); lighting.sunTint.value.setRGB(0,0,0); lighting.lampPower.value = 0;
    renderer.setRenderTarget(target); renderer.render(scene, top); renderer.setRenderTarget(null);
    scene.fog = fog; lighting.ambientTint.value.copy(saved.a); lighting.sunTint.value.copy(saved.s); lighting.lampPower.value = saved.l;
    restore.forEach(child => child.visible = true);
    const raw = new Uint8Array(baseMap.width*baseMap.height*4);
    renderer.readRenderTargetPixels(target, 0, 0, baseMap.width, baseMap.height, raw);
    const image = new ImageData(baseMap.width, baseMap.height);
    for (let y=0; y<baseMap.height; y++) for (let x=0; x<baseMap.width; x++) {
      const from = ((baseMap.height-1-y)*baseMap.width+x)*4, to = (y*baseMap.width+x)*4;
      for (let k=0; k<3; k++) image.data[to+k] = 255*Math.pow(raw[from+k]/255, 1/2.2);
      image.data[to+3] = 255;
    }
    baseMap.getContext('2d').putImageData(image, 0, 0);
    target.dispose();
  }

  // ---- route lines ----
  const lines = {};
  for (const [name, colour] of Object.entries(ROUTE)) {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({color:colour, transparent:true, opacity:0.9, depthWrite:false, side:THREE.DoubleSide, fog:false}));
    mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 2;
    scene.add(mesh); lines[name] = mesh;
  }
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.8, depthWrite:false, fog:false}));
  beacon.visible = false; scene.add(beacon);
  function drawLine(name, dense, fromIndex=0) {
    const mesh = lines[name], points = dense.slice(fromIndex), half = name==='straight' ? 0.035 : 0.055;
    if (points.length<2) { mesh.visible = false; return; }
    const positions = new Float32Array(points.length*6), index = [];
    for (let i=0; i<points.length; i++) {
      const a = points[Math.max(0,i-1)], b = points[Math.min(points.length-1,i+1)];
      const length = Math.hypot(b[0]-a[0], b[2]-a[2]) || 1, nx = -(b[2]-a[2])/length*half, nz = (b[0]-a[0])/length*half;
      const [x,,z] = points[i], y = heightAt(x,z)+0.07;
      positions.set([x+nx,y,z+nz, x-nx,y,z-nz], i*6);
      if (i) index.push(2*i-2,2*i-1,2*i, 2*i-1,2*i+1,2*i);
    }
    mesh.geometry.dispose(); mesh.geometry = new THREE.BufferGeometry();
    mesh.geometry.setAttribute('position', new THREE.BufferAttribute(positions,3)); mesh.geometry.setIndex(index);
    mesh.visible = true; redraw = true;
  }

  const speech = createSpeech(() => {
    $('hudEar').textContent = window.speechSynthesis ? 'Using browser voice' : 'Voice unavailable';
    $('hudEar').classList.add('on');
  });
  addEventListener('pagehide', () => speech.cancel());
  // ---- notes and speech ----
  let noteTimer;
  function note(text, {warn=false, speak=false}={}) {
    const box = $('hudNote');
    box.textContent = text; box.style.color = warn ? '#ff6b5e' : INK; box.classList.add('on');
    state.lastNote = text;
    clearTimeout(noteTimer); noteTimer = setTimeout(() => box.classList.remove('on'), 5000);
    if (speak && !state.muted) void speech.speak(text);
  }

  // ---- routing ----
  const player = () => saved ? [saved.position.x, saved.position.z] : [camera.position.x, camera.position.z];
  const active = () => state.show.custom && state.custom ? 'custom' : 'safe';
  const destination = () => active()==='custom' ? state.custom : state.goal;
  function withProgress(result, at) {
    if (!result) return null;
    let total = 0;
    result.cumulative = result.dense.map((p,i) => i ? total += Math.hypot(p[0]-result.dense[i-1][0], p[2]-result.dense[i-1][2]) : 0);
    result.progress = 0; result.plannedAt = at;
    return result;
  }
  function plan(which) {
    const from = player();
    if (which==='safe') state.routes.safe = withProgress(nav.safe(from, state.goal.position), from);
    if (which==='custom') state.routes.custom = state.custom ? withProgress(nav.safe(from, state.custom.position), from) : null;
    if (which==='straight') state.routes.straight = nav.straight(from, state.goal.position);
    if (which==='home') state.routes.home = withProgress(nav.safe(from, base.position), from);
  }
  function refreshLines() {
    for (const name of ['safe','straight','custom']) {
      const r = state.routes[name], visible = !state.cleared && state.show[name] && r;
      if (visible) drawLine(name, r.dense, r.progress ?? 0); else lines[name].visible = false;
    }
    if (state.warning && state.routes.home) drawLine('home', state.routes.home.dense, state.routes.home.progress); else lines.home.visible = false;
    const target = destination();
    beacon.visible = !state.cleared && !!target;
    if (target) beacon.position.set(target.position[0], heightAt(...target.position)+1.2, target.position[1]);
    redraw = true;
  }
  function replanAll() { plan('safe'); plan('straight'); plan('custom'); refreshLines(); }
  function setCustom(landmark) {
    state.custom = landmark; state.show.custom = true; state.cleared = false; arrived = null;
    plan('custom'); refreshLines(); buildMenus();
    const r = state.routes.custom;
    note(r ? 'Got it. I have a route to '+landmark.name+'. It is about '+Math.round(r.distance)+' meters.' : 'I could not find a walkable route to '+landmark.name+'. Try another destination.', {speak:true});
  }
  let arrived = null;
  function follow() {
    const [x,z] = player();
    for (const name of ['safe','custom','home']) {
      const r = state.routes[name];
      if (!r) continue;
      let bestD = Infinity, bestI = r.progress;
      for (let i=Math.max(0,r.progress-8); i<Math.min(r.dense.length, r.progress+120); i++) {
        const d = Math.hypot(r.dense[i][0]-x, r.dense[i][2]-z);
        if (d<bestD) { bestD = d; bestI = i; }
      }
      const moved = bestI!==r.progress;
      r.progress = bestI;
      if (bestD>3) { plan(name); refreshLines(); }
      else if (moved && (lines[name].visible || name==='home')) refreshLines();
    }
    const target = destination();
    if (target && !state.cleared && arrived!==target && Math.hypot(target.position[0]-x, target.position[1]-z)<config.arrive) {
      arrived = target;
      note('Here we are. You have reached '+target.name+'.', {speak:true});
    }
  }

  // ---- simulated suit telemetry and the return warning ----
  let lastSpot = null, pace = 0, returnTimer = null;
  function telemetry(dt) {
    const [x,z] = player(), speed = lastSpot ? Math.hypot(x-lastSpot[0], z-lastSpot[1])/Math.max(dt,0.001) : 0;
    lastSpot = [x,z];
    pace += (Math.min(speed,6)-pace)*Math.min(1,dt*2);
    if (isLocked() && !state.mapMode) {
      const effort = 1+pace*0.12;
      state.eva += dt;
      state.o2 = Math.max(0, state.o2-dt*effort/(config.o2Minutes*60));
      state.power = Math.max(0, state.power-dt*(1+pace*0.05)/(config.powerMinutes*60));
    }
    state.heart += ((74+pace*13+Math.sin(performance.now()/2300)*2)-state.heart)*Math.min(1,dt*0.6);
    state.temp = 21.4+Math.sin(performance.now()/9000)*0.3+pace*0.15;
  }
  function checkReturn() {
    plan('home');
    const home = state.routes.home, back = home ? home.time : 0;
    const supply = Math.min(state.o2*config.o2Minutes, state.power*config.powerMinutes)*60;
    const usable = supply-config.reserve*Math.min(config.o2Minutes, config.powerMinutes)*60;
    const near = usable<back*1.3+12 && back>3;
    const clock = s => Math.floor(Math.max(0,s)/60)+':'+String(Math.floor(Math.max(0,s)%60)).padStart(2,'0');
    const box = $('hudReturn');
    if (near) {
      box.innerHTML = 'Return to Home Base<small>'+(state.o2*config.o2Minutes<=state.power*config.powerMinutes ? 'O₂' : 'Power')+' '+clock(supply)+' · walk back '+clock(back)+'</small>';
      if (!state.warning) {
        state.warning = true;
        box.classList.remove('docked'); box.style.display = 'block'; $('hudFlash').classList.add('on');
        note('', {}); if (!state.muted) void speech.speak('Warning. Return to Home Base now.');
        clearTimeout(returnTimer);
        returnTimer = setTimeout(() => { box.classList.add('docked'); $('hudFlash').classList.remove('on'); }, 3200);
      }
    } else if (state.warning) { state.warning = false; box.style.display = 'none'; $('hudFlash').classList.remove('on'); }
    refreshLines();
  }
  function refill() { state.o2 = state.power = 1; state.eva = 0; arrived = null; checkReturn(); replanAll(); }

  // ---- planning view ----
  let saved = null, flight = null, savedFog = null;
  const orbit = {azimuth:Math.PI, elevation:0.6, radius:62};
  const center = new THREE.Vector3(W/2, 2, D*0.5), lookHelper = new THREE.Object3D();
  function orbitPose() {
    const flat = Math.cos(orbit.elevation)*orbit.radius;
    const position = new THREE.Vector3(center.x+Math.sin(orbit.azimuth)*flat, center.y+Math.sin(orbit.elevation)*orbit.radius, center.z+Math.cos(orbit.azimuth)*flat);
    lookHelper.position.copy(position); lookHelper.up.set(0,1,0); lookHelper.lookAt(center);
    return {position, quaternion:lookHelper.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI))};
  }
  const fly = (to, seconds, done) => { flight = {from:{position:camera.position.clone(), quaternion:camera.quaternion.clone()}, to, seconds, done, start:performance.now()}; };
  function enterMap() {
    if (state.mapMode) return;
    saved = {position:camera.position.clone(), rotation:camera.rotation.clone()};
    state.mapMode = true; document.body.classList.add('mapmode');
    if (scene.fog) { savedFog = [scene.fog.near, scene.fog.far]; scene.fog.near = 140; scene.fog.far = 420; }   // clear air for the overview
    if (document.pointerLockElement) document.exitPointerLock();
    fly(orbitPose(), 1.4); closeMenus(); buildMenus();
  }
  function exitMap() {
    if (!state.mapMode || !saved || flight?.leaving) return;
    fly({position:saved.position.clone(), quaternion:new THREE.Quaternion().setFromEuler(saved.rotation)}, 1.2, () => {
      camera.position.copy(saved.position); camera.rotation.copy(saved.rotation);
      state.mapMode = false; saved = null; buildMenus();
      if (scene.fog && savedFog) { [scene.fog.near, scene.fog.far] = savedFog; savedFog = null; }
    });
    flight.leaving = true; document.body.classList.remove('mapmode');
  }
  document.addEventListener('pointerlockchange', () => { if (isLocked() && state.mapMode) exitMap(); if (isLocked()) closeMenus(); });
  let drag = null;
  canvas.addEventListener('pointerdown', event => { if (state.mapMode) drag = {x:event.clientX, y:event.clientY, moved:false}; });
  addEventListener('pointermove', event => {
    if (!drag || !state.mapMode || flight) return;
    const dx = event.clientX-drag.x, dy = event.clientY-drag.y;
    if (Math.abs(dx)+Math.abs(dy)>3) drag.moved = true;
    if (!drag.moved) return;
    orbit.azimuth -= dx*0.005; orbit.elevation = Math.min(1.45, Math.max(0.18, orbit.elevation+dy*0.004));
    drag.x = event.clientX; drag.y = event.clientY;
    const pose = orbitPose(); camera.position.copy(pose.position); camera.quaternion.copy(pose.quaternion); redraw = true;
  });
  addEventListener('pointerup', event => {
    if (drag && !drag.moved && state.mapMode && !flight && event.target===canvas) pick(event.clientX, event.clientY);
    drag = null;
  });
  canvas.addEventListener('wheel', event => {
    if (!state.mapMode || flight) return;
    orbit.radius = Math.min(120, Math.max(14, orbit.radius*(event.deltaY>0 ? 1.1 : 0.9)));
    const pose = orbitPose(); camera.position.copy(pose.position); camera.quaternion.copy(pose.quaternion); redraw = true;
  }, {passive:true});
  canvas.addEventListener('click', () => { if (!state.mapMode && !isLocked()) { closeMenus(); enterButton.click(); } });
  // Roxy starts with the first click, because browsers only allow the microphone after a user action.
  let roxyAsked = false;
  addEventListener('pointerdown', () => { if (!roxyAsked) { roxyAsked = true; setRoxy(true); } });
  function pick(clientX, clientY) {
    const direction = new THREE.Vector3(clientX/innerWidth*2-1, -(clientY/innerHeight)*2+1, 0.5).unproject(camera).sub(camera.position).normalize();
    for (let t=0; t<220; t+=0.1) {
      const x = camera.position.x+direction.x*t, y = camera.position.y+direction.y*t, z = camera.position.z+direction.z*t;
      const s = ground.sample(x,z);
      if (s && y<=s.height) { if (nav.index(x,z)>=0) setCustom({id:'mark', name:'Marked point', aliases:[], position:[x,z]}); return; }
    }
  }
  const labels = landmarks.map(landmark => {
    const element = Object.assign(document.createElement('div'), {className:'label', innerHTML:landmark.name+'<small></small>'});
    element.onclick = () => landmark===summit ? (state.show.custom = false, state.cleared = false, refreshLines(), buildMenus()) : setCustom(landmark);
    root.appendChild(element);
    return {element, landmark, point:new THREE.Vector3(landmark.position[0], heightAt(...landmark.position)+0.3, landmark.position[1])};
  });
  const projected = new THREE.Vector3();

  // ---- commands: typing, menus and speech share this ----
  const replyCounts = {};
  function command(text) {
    const request = text.replace(/^(?:(?:hey|hi)[, ]+)?(?:please\s+|(?:can|could|would) you\s+|i(?:'d| would) like (?:you )?to\s+)/i, '')
      .replace(/[, ]+please[.!?]*$/i, '').trim();

    const phrase = request.toLowerCase().replace(/[!?.,]/g, '').trim();
    const replies = {
      greeting: ["Hey, I'm here. Where would you like to go?", "Hi there. Ready when you are.", "Hey. What can I help you with?"],
      thanks: ["You're welcome.", "Anytime. Let me know what you need.", "Happy to help."],
      check: ["I'm here. Go ahead.", "I'm here. What do you need?", "Right here. What's next?"]
    };
    let kind;
    if (/^(hi|hello|hey|good morning|good afternoon)$/.test(phrase)) kind = 'greeting';
    if (/^(thanks|thank you|thanks a lot|thank you so much|cheers)$/.test(phrase)) kind = 'thanks';
    if (/^(are you there|can you hear me|you there)$/.test(phrase)) kind = 'check';
    if (kind) {
      const lines = replies[kind];
      const index = replyCounts[kind] || 0;
      replyCounts[kind] = index + 1;
      note(lines[index % lines.length], {speak:true});
      return 'conversation';
    }
    if (/^(help|help me|what can you do|what can i say)$/.test(phrase)) {
      note('I can find a route, show the slopes, or open the map. Try asking me to take you to the slab.', {speak:true});
      return 'conversation';
    }
    if (/^(how are you|how are you doing)$/.test(phrase)) {
      note("Ready to help you explore. What would you like to do next?", {speak:true});
      return 'conversation';
    }
    if (/^(repeat|say that again|repeat that|what did you say)$/.test(phrase)) {
      note(state.lastNote || "I'm here. Where would you like to go?", {speak:true});
      return 'conversation';
    }
    if (/^(how much oxygen.*|oxygen status|check my oxygen)$/.test(phrase)) {
      note('Your simulated oxygen is at ' + Math.round(state.o2 * 100) + ' percent.' +
        (state.warning ? ' Head back to Home Base now.' : ''), {speak:true});
      return 'conversation';
    }
    const parsed = parseCommand(request, landmarks);
    if (parsed.type==='goto') {
      if (parsed.landmark===summit) { state.show.custom = false; state.show.safe = true; state.cleared = false; arrived = null; replanAll(); buildMenus(); note(state.routes.safe ? 'All right. Follow the highlighted route toward Ridge summit.' : 'I could not find a route to Ridge summit from here.', {speak:true}); }
      else setCustom(parsed.landmark);
    } else if (parsed.type==='clear') { state.cleared = true; refreshLines(); note('All right, I cleared the route. Where would you like to go next?', {speak:true}); }
    else if (parsed.type==='layer') { const shown = state.layer===parsed.layer && overlayTarget===1; setLayer(parsed.layer, parsed.on==='toggle' ? !shown : parsed.on); }
    else if (parsed.type==='route') {
      if (parsed.which==='custom' && !state.custom) note('No voice route yet. Say "take me to the slab".');
      else { const shown = state.show[parsed.which] && !state.cleared; state.show[parsed.which] = parsed.on==='toggle' ? !shown : parsed.on; state.cleared = false; replanAll(); buildMenus(); }
    }
    else if (parsed.type==='map') { const entering = !state.mapMode; entering ? enterMap() : exitMap(); note(entering ? 'Here is the map. Pick a spot and I will look for a route.' : 'Back to the terrain.', {speak:true}); }
    else if (parsed.type==='close') { closeMenus(); if (state.mapMode) exitMap(); }
    else if (parsed.type==='reset') resetAll();
    else if (parsed.type==='menu') { const button = root.querySelector('[data-menu=hud'+parsed.menu[0].toUpperCase()+parsed.menu.slice(1)+']'); if (document.pointerLockElement) document.exitPointerLock(); if (!$(button.dataset.menu).classList.contains('open')) button.click(); }
    else if (parsed.type==='mute') { state.muted = parsed.on==='toggle' ? !state.muted : parsed.on; if (state.muted) speech.cancel(); buildMenus(); }
    else if (parsed.type==='drain') { state.o2 = Math.min(state.o2, 0.24); checkReturn(); }
    else if (parsed.type==='unknown') note('I did not catch a destination or command there. You can say, take me to the slab, or ask me for help.', {speak:true});
    return parsed.type;
  }

  // ---- the two menus ----
  function closeMenus() { for (const m of root.querySelectorAll('.menu')) m.classList.remove('open'); for (const b of root.querySelectorAll('[data-menu]')) b.classList.remove('open'); }
  function item(menu, text, on, action, {colour, disabled}={}) {
    const row = Object.assign(document.createElement('div'), {innerHTML:'<i></i>'+text});
    if (on) row.classList.add('on');
    if (disabled) row.classList.add('off');
    if (colour) row.style.setProperty('--tone', colour);
    row.onclick = event => { event.stopPropagation(); if (!disabled) action(); };
    menu.appendChild(row);
  }
  function buildMenus() {
    const options = $('hudOptions'), routes = $('hudRoutes');
    options.textContent = routes.textContent = '';
    item(options, 'Slope', state.layer==='slope' && overlayTarget===1, () => setLayer('slope', !(state.layer==='slope' && overlayTarget===1)));
    item(options, 'Ground truth', state.layer==='truth' && overlayTarget===1, () => setLayer('truth', !(state.layer==='truth' && overlayTarget===1)));
    item(options, 'Map', state.mapMode, () => state.mapMode ? exitMap() : enterMap());
    item(options, 'Clear route', state.cleared, () => { state.cleared = !state.cleared; refreshLines(); buildMenus(); });
    item(options, 'Mute', state.muted, () => command(state.muted ? 'unmute' : 'mute'));
    item(options, Recognition ? 'Roxy voice' : 'Roxy voice · unavailable', roxy.enabled, () => setRoxy(!roxy.enabled), {colour:AMBER, disabled:!Recognition});
    const toggle = name => () => { state.show[name] = !state.show[name]; state.cleared = false; replanAll(); buildMenus(); };
    item(routes, 'Straight line', state.show.straight && !state.cleared, toggle('straight'), {colour:ROUTE.straight});
    item(routes, 'Safe route', state.show.safe && !state.cleared, toggle('safe'), {colour:ROUTE.safe});
    item(routes, state.custom ? 'Voice route · '+state.custom.name : 'Voice route · none yet', state.show.custom && !state.cleared && !!state.custom, toggle('custom'), {colour:ROUTE.custom, disabled:!state.custom});
  }
  for (const button of root.querySelectorAll('[data-menu]')) button.onclick = event => {
    event.stopPropagation();
    const menu = $(button.dataset.menu), open = !menu.classList.contains('open');
    closeMenus(); menu.classList.toggle('open', open); button.classList.toggle('open', open);
  };

  const input = $('hudCmd'), typeBox = root.querySelector('.type');
  const closeType = () => { typeBox.style.display = 'none'; input.value = ''; input.blur(); };
  input.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key==='Enter') { const text = input.value.trim(); closeType(); if (text) command(text); }
    if (event.key==='Escape') closeType();
  });
  input.addEventListener('keyup', event => event.stopPropagation());

  // Roxy: wake-word voice control. The recogniser listens continuously for "Roxy", then takes the next phrase
  // as a command. In Chrome the audio goes to an online speech service while Roxy is on, so it is a visible toggle.
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const roxy = {enabled:false, armed:false, running:false, recogniser:null, timer:null, handled:-1};
  const WAKE = /\b(roxy|roxie|roxi|rocksy|rocksie|rock ?sea|rocky|proxy|foxy|rox)\b[\s,.!?]*/i;
  function arm(on) {
    if (on) speech.cancel();
    roxy.armed = on;
    $('hudRoxy').classList.toggle('on', on);
    if (on) $('hudHeard').textContent = '';
    clearTimeout(roxy.timer);
    if (on) roxy.timer = setTimeout(() => arm(false), 7000);
  }
  function hear(text, final) {
    const wake = WAKE.exec(text);
    let said = text;
    if (wake) { if (!roxy.armed) arm(true); said = text.slice(wake.index+wake[0].length); }
    if (!roxy.armed) return;
    said = said.trim();
    $('hudHeard').textContent = said;
    if (said) { clearTimeout(roxy.timer); roxy.timer = setTimeout(() => arm(false), 7000); }
    if (final && said) { arm(false); command(said); }
  }
  function startRecogniser() {
    if (!Recognition || roxy.running || !roxy.enabled) return;
    const r = roxy.recogniser = Object.assign(new Recognition(), {lang:'en-US', interimResults:true, continuous:true});
    r.onresult = event => {
      for (let i=event.resultIndex; i<event.results.length; i++) {
        const result = event.results[i];
        hear(result[0].transcript, result.isFinal);
      }
    };
    r.onerror = event => {
      if (event.error==='not-allowed' || event.error==='service-not-allowed') { roxy.enabled = false; note('Microphone permission denied. Press T to type commands.'); refreshRoxy(); }
      else if (event.error==='network') { roxy.enabled = false; note('Roxy needs a network connection in this browser. Press T to type commands.'); refreshRoxy(); }
    };
    r.onend = () => { roxy.running = false; if (roxy.enabled) setTimeout(startRecogniser, 250); };   // Chrome stops after silence; keep listening
    try { r.start(); roxy.running = true; } catch {}
  }
  function refreshRoxy() { $('hudEar').classList.toggle('on', roxy.enabled); if (!roxy.enabled) arm(false); buildMenus(); }
  function setRoxy(on) {
    roxy.enabled = on && !!Recognition;
    if (roxy.enabled) startRecogniser(); else roxy.recogniser?.stop();
    refreshRoxy();
  }
  function resetAll() { resetButton?.click(); refill(); closeMenus(); note('Position reset'); }
  $('hudReset').onclick = resetAll;
  addEventListener('keydown', event => {
    if (event.target===input) return;
    if (event.code==='KeyV') { if (!event.repeat) { if (!roxy.enabled) setRoxy(true); arm(true); } return; }
    if (event.repeat) return;
    if (event.code==='KeyM') state.mapMode ? exitMap() : enterMap();
    else if (event.code==='KeyC') command('clear route');
    else if (event.code==='KeyN') command(state.muted ? 'unmute' : 'mute');
    else if (event.code==='KeyG') setLayer('truth', !(state.layer==='truth' && overlayTarget===1));
    else if (event.code==='KeyL') setLayer('slope', !(state.layer==='slope' && overlayTarget===1));
    else if (event.code==='KeyR') refill();
    else if (event.code==='KeyT') { event.preventDefault(); if (document.pointerLockElement) document.exitPointerLock(); typeBox.style.display = 'block'; input.focus(); }
  });

  // ---- drawing ----
  const bearingOf = yaw => (Math.atan2(Math.sin(yaw), -Math.cos(yaw))*180/Math.PI+360)%360;
  function drawCompass(yaw) {
    const {width:w, height:h} = tape.canvas, bearing = bearingOf(yaw), scale = w/150, y = 30;
    tape.clearRect(0,0,w,h);
    tape.textAlign = 'center'; tape.fillStyle = tape.strokeStyle = INK; tape.shadowColor = '#000c'; tape.shadowBlur = 3;
    for (let d=Math.ceil((bearing-75)/5)*5; d<=bearing+75; d+=5) {
      const x = w/2+(d-bearing)*scale, deg = (d+360)%360, edge = Math.max(0, 1-Math.abs(d-bearing)/75);
      tape.globalAlpha = Math.min(1, edge*2.2);
      tape.lineWidth = deg%45===0 ? 2 : 1;
      tape.beginPath(); tape.moveTo(x, y); tape.lineTo(x, y+(deg%45===0 ? 12 : deg%15===0 ? 8 : 4)); tape.stroke();
      if (deg%90===0) { tape.font = '700 17px Bahnschrift,"Segoe UI",sans-serif'; tape.fillText('NESW'[deg/90], x, 22); }
      else if (deg%45===0) { tape.font = '600 12px Bahnschrift,"Segoe UI",sans-serif'; tape.fillText(['NE','SE','SW','NW'][(deg-45)/90], x, 22); }
      else if (deg%15===0) { tape.font = '500 10px Bahnschrift,"Segoe UI",sans-serif'; tape.globalAlpha *= 0.75; tape.fillText(String(deg), x, 22); }
    }
    tape.globalAlpha = 1;
    const target = !state.cleared && destination();
    if (target) {
      const [x,z] = player();
      const delta = Math.max(-72, Math.min(72, (Math.atan2(-(target.position[0]-x), target.position[1]-z)*180/Math.PI-bearing+540)%360-180));
      const px = w/2+delta*scale;
      tape.fillStyle = ROUTE[active()];
      tape.beginPath(); tape.moveTo(px, y-4); tape.lineTo(px+6, y+3); tape.lineTo(px, y+10); tape.lineTo(px-6, y+3); tape.fill();
    }
    tape.fillStyle = INK; tape.beginPath(); tape.moveTo(w/2-6, 0); tape.lineTo(w/2+6, 0); tape.lineTo(w/2, 8); tape.fill();
    $('hudBearing').textContent = String(Math.round(bearing)%360).padStart(3,'0');
  }

  function drawMini(yaw) {
    // Fixed view of the rendered patch (plus a 4 m rim so Home Base shows); only the cursor moves.
    const {width:w, height:hh} = mini.canvas, rim = 4, s = w/(W+2*rim), [px,pz] = player();
    const sx = x => (W+rim-x)*s, sy = z => (D+rim-z)*s;
    mini.fillStyle = '#2a211c'; mini.fillRect(0,0,w,hh);
    mini.imageSmoothingEnabled = true;
    mini.drawImage(baseMap, sx(EX+EW), sy(EZ+ED), EW*s, ED*s);
    if (state.layer && overlayFade>0.02) {
      mini.save(); mini.globalAlpha = 0.7*overlayFade; mini.translate(sx(EX), sy(EZ)); mini.scale(-EW*s/nav.cols, -ED*s/nav.rows);
      mini.drawImage(overlayCanvas, 0, 0); mini.restore();
    }
    for (const name of ['straight','safe','custom','home']) {
      const r = state.routes[name];
      if (!r || !lines[name].visible) continue;
      mini.beginPath();
      r.dense.slice(r.progress ?? 0).forEach(([x,,z],i) => i ? mini.lineTo(sx(x),sy(z)) : mini.moveTo(sx(x),sy(z)));
      mini.strokeStyle = '#0009'; mini.lineWidth = 3.5; mini.stroke();
      mini.strokeStyle = ROUTE[name]; mini.lineWidth = name==='straight' ? 1.5 : 2; mini.stroke();
    }
    const target = !state.cleared && destination();
    if (target) {
      const tx = sx(target.position[0]), ty = sy(target.position[1]);
      mini.fillStyle = ROUTE[active()]; mini.strokeStyle = '#000'; mini.lineWidth = 1.2;
      mini.beginPath(); mini.moveTo(tx, ty-6); mini.lineTo(tx+5, ty); mini.lineTo(tx, ty+6); mini.lineTo(tx-5, ty); mini.closePath(); mini.fill(); mini.stroke();
    }
    mini.fillStyle = '#fff'; mini.strokeStyle = '#000'; mini.lineWidth = 1;
    mini.fillRect(sx(base.position[0])-3, sy(base.position[1])-3, 6, 6); mini.strokeRect(sx(base.position[0])-3, sy(base.position[1])-3, 6, 6);
    mini.save(); mini.translate(Math.max(6, Math.min(w-6, sx(px))), Math.max(6, Math.min(hh-6, sy(pz)))); mini.rotate(bearingOf(yaw)*Math.PI/180);
    mini.beginPath(); mini.moveTo(0,-8); mini.lineTo(6,6); mini.lineTo(0,3); mini.lineTo(-6,6); mini.closePath();
    mini.fillStyle = '#fff'; mini.strokeStyle = '#111'; mini.lineWidth = 2; mini.lineJoin = 'round'; mini.stroke(); mini.fill(); mini.restore();
  }

  const figure = new Path2D('M-5-22 L5-22 L27-12 L25-4 L8-10 L8 8 L11 36 L3 36 L0 15 L-3 36 L-11 36 L-8 8 L-8-10 L-25-4 L-27-12Z');
  function drawSuit() {
    const g = suit, {width:w, height:h} = g.canvas, cx = 118, cy = 116, R = 88, rad = d => d*Math.PI/180;
    g.clearRect(0,0,w,h);
    g.lineCap = 'butt'; g.shadowColor = '#000a'; g.shadowBlur = 4;
    g.strokeStyle = '#ffffff40'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx,cy,R+16,0,7); g.stroke();
    const arc = (from, to, value, colour) => {
      g.lineWidth = 13; g.strokeStyle = '#ffffff22'; g.beginPath(); g.arc(cx,cy,R,rad(from),rad(to)); g.stroke();
      g.strokeStyle = colour; g.beginPath(); g.arc(cx,cy,R,rad(from),rad(from+(to-from)*value)); g.stroke();
      g.lineWidth = 1; g.strokeStyle = '#ffffffaa';
      for (let k=0; k<=10; k++) { const a = rad(from+(to-from)*k/10), r0 = R+9, r1 = R+(k%5 ? 12 : 15);
        g.beginPath(); g.moveTo(cx+Math.cos(a)*r0, cy+Math.sin(a)*r0); g.lineTo(cx+Math.cos(a)*r1, cy+Math.sin(a)*r1); g.stroke(); }
    };
    const low = v => v<0.25;
    arc(170, 280, state.o2, low(state.o2) ? RED : INK);        // oxygen, upper left
    arc(-35, 75, state.power, low(state.power) ? RED : AMBER); // suit power, right
    g.textAlign = 'center'; g.fillStyle = INK;
    g.font = '700 13px Bahnschrift,"Segoe UI",sans-serif'; g.fillText('O₂', cx-48, cy-42);
    g.font = '600 11px Bahnschrift,"Segoe UI",sans-serif'; g.fillText(Math.round(state.o2*100)+'%', cx-48, cy-28);
    g.font = '700 13px Bahnschrift,"Segoe UI",sans-serif'; g.fillText('PWR', cx+54, cy+16);
    g.font = '600 11px Bahnschrift,"Segoe UI",sans-serif'; g.fillText(Math.round(state.power*100)+'%', cx+54, cy+30);
    const strain = state.heart>150 || low(state.o2) ? RED : state.heart>125 ? AMBER : '#8dff6a';
    g.save(); g.translate(cx, cy-4); g.scale(1.15,1.15);
    g.fillStyle = strain; g.globalAlpha = 0.85; g.fill(figure); g.beginPath(); g.arc(0,-31,7,0,7); g.fill();
    g.globalAlpha = 1; g.strokeStyle = '#fff'; g.lineWidth = 1.4; g.stroke(figure); g.beginPath(); g.arc(0,-31,7,0,7); g.stroke(); g.restore();
    g.fillStyle = INK; g.font = '600 12px Bahnschrift,"Segoe UI",sans-serif';
    g.textAlign = 'right'; g.fillText('♥ '+Math.round(state.heart), cx-8, cy+64);
    g.textAlign = 'left'; g.fillText(state.temp.toFixed(1)+'°C', cx+8, cy+64);
    const [x,z] = player();
    $('hudCoords').innerHTML = 'N '+(meta.origin[0]+z).toFixed(1)+' · E '+(meta.origin[1]-x).toFixed(1)+' m<b>Site 26 frame</b>';
  }

  function placePin() {
    const pin = $('hudPin'), target = !state.cleared && destination(), r = state.routes[active()];
    if (!target || !r || flight || state.mapMode) { pin.style.display = 'none'; return; }
    projected.set(target.position[0], heightAt(...target.position)+2.4, target.position[1]).project(camera);
    if (projected.z>1 || Math.abs(projected.x)>1.05) { pin.style.display = 'none'; return; }
    const left = r.distance-r.cumulative[r.progress], seconds = r.time*left/Math.max(r.distance,0.01);
    const px = (projected.x+1)/2*innerWidth, py = Math.max(150, (1-projected.y)/2*innerHeight);
    // Keep clear of the title, the compass and the minimap.
    if ((px<330 && py<300) || (px>innerWidth-330 && py<300)) { pin.style.display = 'none'; return; }
    pin.style.display = 'block'; pin.style.left = px+'px'; pin.style.top = py+'px';
    pin.innerHTML = '<b>'+Math.round(seconds)+'</b>s<em>/</em><b>'+Math.round(left)+'</b>m';
  }
  function placeLabels() {
    for (const {element, point, landmark} of labels) {
      if (!state.mapMode || flight) { element.style.display = 'none'; continue; }
      const r = landmark===destination() && !state.cleared ? state.routes[active()] : null;
      element.lastChild.textContent = r ? Math.round(r.time*(1-r.cumulative[r.progress]/Math.max(r.distance,0.01)))+' s / '+Math.round(r.distance-r.cumulative[r.progress])+' m' : '';
      projected.copy(point).project(camera);
      element.style.display = projected.z<1 ? 'block' : 'none';
      element.style.left = (projected.x+1)/2*innerWidth+'px'; element.style.top = (1-projected.y)/2*innerHeight+'px';
    }
  }

  // ---- per-frame update. Returns true when the 3D view must be redrawn. ----
  let quick = 0, slow = 9, straightTick = 0;
  function update(dt, now, yaw) {
    if (flight) {
      const t = Math.min(1, (performance.now()-flight.start)/1000/flight.seconds), k = t*t*(3-2*t);
      camera.position.lerpVectors(flight.from.position, flight.to.position, k);
      camera.quaternion.slerpQuaternions(flight.from.quaternion, flight.to.quaternion, k);
      redraw = true;
      if (t===1) { const done = flight.done; flight = null; done?.(); }
    }
    if (overlayFade!==overlayTarget) {
      overlayFade += Math.sign(overlayTarget-overlayFade)*Math.min(Math.abs(overlayTarget-overlayFade), dt/0.5);
      uniforms.overlayOpacity.value = overlayFade; redraw = true;
      if (overlayFade===0 && pendingClear) { pendingClear = false; state.layer = null; }
    }
    if (overlayDirty && state.layer) paintOverlay();
    quick += dt; slow += dt; straightTick += dt;
    if (quick>0.15) { telemetry(quick); quick = 0; follow(); }
    if (straightTick>0.5) { straightTick = 0; if (state.show.straight && !state.cleared) { plan('straight'); drawLine('straight', state.routes.straight.dense); } }
    if (slow>2) { slow = 0; checkReturn(); }
    drawCompass(yaw); drawMini(yaw); drawSuit(); placePin(); placeLabels();
    const result = redraw; redraw = false;
    return result;
  }

  replanAll(); buildMenus();
  return {update, command, state, nav, landmarks, enterMap, exitMap, setLayer, camera, refill, hear, roxy,
    get flying() { return !!flight; }};
}
