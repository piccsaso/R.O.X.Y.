// Helmet HUD: route guidance, simulated scanner, live re-route, data highlights,
// planning view, typed and spoken commands. Everything reads the same ground
// the walker collides with.
import {makeNav, makePriorGround, makeLandmarks, parseCommand, config} from './nav.mjs';

const css = `
#hud{position:fixed;inset:0;pointer-events:none;font:12px/1.35 ui-monospace,Consolas,monospace;color:#bff6ff;text-shadow:0 0 4px #000a;z-index:2}
#hud .frame{position:absolute;inset:0;box-shadow:inset 0 0 140px 30px #0009;border-radius:38px}
#hud canvas{display:block;width:auto;height:auto}
body.locked #hud [data-dest]{display:none}
#hud .tape{position:absolute;top:14px;left:50%;transform:translateX(-50%)}
#hud .mini{position:absolute;top:14px;right:18px;background:#0a1114cc;border:1px solid #6fd6e688;border-radius:6px;padding:6px}
#hud .mini small,#hud .radar small{display:block;margin-top:4px;color:#9cc;font-size:10px;max-width:224px}
#hud .radar{position:absolute;right:18px;bottom:84px;background:#0a1114cc;border:1px solid #6fd6e688;border-radius:6px;padding:6px}
#hud .status{position:absolute;left:clamp(16px,4vw,56px);top:42%;transform:translateY(-50%);background:#0a1114b8;border-left:2px solid #6fd6e6;padding:8px 12px;min-width:230px}
#hud .status div{display:flex;justify-content:space-between;gap:14px;white-space:nowrap}
#hud .status b{color:#fff;font-weight:600}
#hud .tag{font-size:9px;border:1px solid currentColor;border-radius:3px;padding:0 3px;margin-left:6px;opacity:.75}
#hud .gauge{height:5px;background:#234;margin:3px 0 5px;display:block}
#hud .gauge i{display:block;height:100%;background:#6fd6e6}
#hud .alert{position:absolute;top:66px;left:50%;transform:translateX(-50%);max-width:min(720px,70vw);text-align:center;font-size:15px;padding:8px 16px;background:#0a1114d9;border:1px solid #6fd6e6;border-radius:6px;opacity:0;transition:opacity .3s}
#hud .alert.on{opacity:1}
#hud .alert.warn{border-color:#ffb347;color:#ffd9a0}
#hud .bar{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px}
#hud .buttons{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;pointer-events:auto}
#hud button{font:inherit;color:#bff6ff;background:#0a1114d9;border:1px solid #6fd6e688;border-radius:5px;padding:5px 9px;cursor:pointer}
#hud button.on{background:#1d5560;color:#fff;border-color:#bff6ff}
#hud button:disabled{opacity:.45;cursor:default}
#hud .legend{font-size:11px;color:#dff;background:#0a1114d9;padding:4px 10px;border-radius:5px;display:none;max-width:70vw;text-align:center}
#hud .legend i{display:inline-block;width:10px;height:10px;margin:0 4px 0 10px;vertical-align:-1px}
#hud .cmd{display:flex;gap:6px;pointer-events:auto}
#hud .cmd input{font:inherit;width:min(420px,50vw);padding:6px 9px;color:#fff;background:#0a1114e6;border:1px solid #6fd6e6;border-radius:5px}
#hud .heard{min-height:16px;color:#fff}
#hud .card{position:absolute;right:18px;top:250px;width:290px;background:#0a1114e6;border:1px solid #6fd6e6;border-radius:6px;padding:12px;display:none;pointer-events:auto}
#hud .card h3{margin:0 0 6px;font:600 15px system-ui;color:#fff}
#hud .card p{margin:0 0 8px;font:12px/1.45 system-ui;color:#dfeff2}
#hud .card a{color:#8fe9ff}
#hud .label{position:absolute;transform:translate(-50%,-100%);font:italic 14px Georgia,serif;color:#fff;padding-bottom:34px;pointer-events:auto;cursor:pointer;white-space:nowrap;display:none}
#hud .label::after{content:"";position:absolute;left:50%;bottom:0;height:30px;border-left:1px solid #fff}
#hud .settings{display:none;gap:8px;align-items:center;font-size:11px;pointer-events:auto;background:#0a1114d9;padding:4px 10px;border-radius:5px}
#hud .settings input{width:52px;font:inherit;background:#012;color:#fff;border:1px solid #6fd6e688;border-radius:3px;padding:1px 4px}
body:not(.locked) #hud .settings{display:flex}
body.locked header{opacity:0;transition:opacity .4s}
body.locked #hud .cmd{opacity:.55}
`;

const html = `
<div class="frame"></div>
<canvas class="tape" width="420" height="38"></canvas>
<div class="mini"><canvas width="224" height="196"></canvas><small id="hudMapNote"></small></div>
<div class="radar"><canvas width="150" height="150"></canvas><small>SIMULATED SCANNER<br>reading measured terrain</small></div>
<div class="status">
  <div><span>HEADING</span><b id="hudHeading"></b></div>
  <div><span>SLOPE<span class="tag">DERIVED</span></span><b id="hudSlope"></b></div>
  <div><span>GROUND<span class="tag">OBSERVED</span></span><b id="hudGround"></b></div>
  <div><span>SURVEY<span class="tag">SIMULATED</span></span><b id="hudScan"></b></div>
  <div><span>ROUTE</span><b id="hudRoute">none</b></div>
  <div><span>ETA<span class="tag">ASSUMED</span></span><b id="hudEta">–</b></div>
  <div><span>SAFE RETURN<span class="tag">ASSUMED</span></span><b id="hudReturn">–</b></div>
  <span class="gauge"><i id="hudGauge"></i></span>
</div>
<div class="alert" id="hudAlert"></div>
<div class="card" id="hudCard"></div>
<div class="bar">
  <div class="heard" id="hudHeard"></div>
  <div class="legend" id="hudLegend"></div>
  <div class="settings">EVA budget <input id="hudBudget" type="number" min="1" step="1"> min · reserve <input id="hudReserve" type="number" min="0" max="90" step="5"> % <span class="tag">ASSUMED</span></div>
  <div class="buttons" id="hudButtons"></div>
  <div class="cmd"><input id="hudCmd" placeholder='T: type a command, e.g. "take me to the upper bench"' autocomplete="off"><button id="hudMic" title="Hold V to speak">V Voice</button></div>
</div>`;

const layers = {
  hazard: {key:'1', name:'Hazards', legend:'<i style="background:#ff3b30"></i>cannot be walked (step over 17 cm, or unmapped) <i style="background:#ff9f0a"></i>blocked on the prior map only <span class="tag">TERRAIN-DERIVED</span> from Navcam stereo surface, 14 cm grid'},
  slope: {key:'2', name:'Slope', legend:'<i style="background:#ffe14d"></i>10 to 20° <i style="background:#ff9f0a"></i>20 to 30° <i style="background:#ff3b30"></i>over 30° <span class="tag">TERRAIN-DERIVED</span> from Navcam stereo surface, 3.5 cm samples'},
  truth: {key:'3', name:'Ground truth', legend:'<i style="background:#2dd4bf"></i>rover-measured (Navcam stereo) <i style="background:#f59e0b"></i>inferred fill <span class="tag">OBSERVATION</span> NASA/JPL-Caltech Navcam mesh products, sols 470 to 501'},
  scan: {key:'4', name:'Surveyed', legend:'<i style="background:#38bdf8"></i>surveyed by the suit scanner this walk <i style="background:#334"></i>prior map only (rover surface averaged to 1 m) <span class="tag">SIMULATED</span>'}
};

export async function initHud(ctx) {
  const {THREE, scene, camera, renderer, canvas, ground, meta, route, binary, terrain, material, eyeHeight, isLocked, setPose} = ctx;
  const [W, D] = meta.boundsMeters;
  const prior = makePriorGround(meta, binary);
  const nav = makeNav(meta, ground, prior);
  const landmarks = makeLandmarks(route);
  const spawn = [route.spawn.x, route.spawn.z];

  // Measured versus inferred support, from the build's coverage map.
  let coverage;
  try {
    const image = new Image();
    image.src = 'terrain-coverage.png';
    await image.decode();
    const c = Object.assign(document.createElement('canvas'), {width:image.width, height:image.height});
    const g = c.getContext('2d', {willReadFrequently:true});
    g.drawImage(image, 0, 0);
    coverage = {width:image.width, height:image.height, data:g.getImageData(0,0,image.width,image.height).data};
  } catch { coverage = null; }
  nav.inferredAt = (x,z) => {
    if (!coverage) return false;
    const col = Math.floor(x/meta.step), row = Math.floor(z/meta.step);
    if (col<0 || row<0 || col>=coverage.width || row>=coverage.height) return true;
    return coverage.data[(row*coverage.width+col)*4]===103;
  };

  document.head.appendChild(Object.assign(document.createElement('style'), {textContent:css}));
  const root = Object.assign(document.createElement('div'), {id:'hud', innerHTML:html});
  document.body.appendChild(root);
  const $ = id => root.querySelector('#'+id);
  const tape = root.querySelector('.tape').getContext('2d');
  const mini = root.querySelector('.mini canvas').getContext('2d');
  const radar = root.querySelector('.radar canvas').getContext('2d');
  $('hudMapNote').textContent = 'North up. Navcam-derived terrain, 28 × 24.5 m.';
  $('hudBudget').value = config.evaBudgetMin;
  $('hudReserve').value = config.reserve*100;
  $('hudBudget').onchange = event => { config.evaBudgetMin = Math.max(1, Number(event.target.value) || 1); warned = false; };
  $('hudReserve').onchange = event => { config.reserve = Math.min(0.9, Math.max(0, Number(event.target.value)/100 || 0)); warned = false; };

  // ---- state ----
  const state = {layer:null, mapMode:false, muted:false, route:null, goalName:null, eva:0, lastAlert:''};
  let overlayFade = 0, overlayTarget = 0, overlayDirty = true, warned = false, redraw = true;

  // ---- overlay draped on the terrain: tints the rock, relief shows through ----
  const overlayCanvas = Object.assign(document.createElement('canvas'), {width:nav.cols, height:nav.rows});
  const overlayContext = overlayCanvas.getContext('2d');
  const overlayTexture = new THREE.CanvasTexture(overlayCanvas);
  overlayTexture.flipY = false;
  overlayTexture.colorSpace = THREE.SRGBColorSpace;
  overlayTexture.generateMipmaps = false;
  overlayTexture.minFilter = overlayTexture.magFilter = THREE.LinearFilter;
  const uniforms = {overlayMap:{value:overlayTexture}, overlayExtent:{value:new THREE.Vector2(W,D)}, overlayOpacity:{value:0}};
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec2 vOverlayXZ;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvOverlayXZ=(modelMatrix*vec4(position,1.0)).xz;');
    shader.fragmentShader = 'uniform sampler2D overlayMap;uniform vec2 overlayExtent;uniform float overlayOpacity;varying vec2 vOverlayXZ;\n'+
      shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        vec4 ov=texture2D(overlayMap,vOverlayXZ/overlayExtent);
        float lum=dot(diffuseColor.rgb,vec3(0.3333));
        vec3 tinted=ov.rgb*(0.22+1.25*lum);
        diffuseColor.rgb=mix(diffuseColor.rgb*mix(1.0,0.72,overlayOpacity),tinted,ov.a*overlayOpacity);`);
  };
  material.customProgramCacheKey = () => 'hud-overlay';
  material.needsUpdate = true;

  function paintOverlay() {
    overlayDirty = false;
    const image = overlayContext.createImageData(nav.cols, nav.rows), px = image.data;
    const set = (i,r,g,b,a) => { px[i*4]=r; px[i*4+1]=g; px[i*4+2]=b; px[i*4+3]=a; };
    for (let i=0; i<nav.cols*nav.rows; i++) {
      const [x,z] = nav.center(i);
      if (state.layer==='hazard') {
        if (nav.scanned[i] ? !nav.okTruth[i] : false) set(i,255,59,48,235);
        else if (!nav.scanned[i] && !nav.okPrior[i]) set(i,255,159,10,215);
      } else if (state.layer==='truth') {
        if (nav.inferredAt(x,z)) set(i,245,158,11,185); else set(i,45,212,191,135);
      } else if (state.layer==='scan') {
        if (nav.scanned[i]) set(i,56,189,248,175);
      } else if (state.layer==='slope') {
        const s = ground.sample(x,z);
        const deg = s ? Math.atan(s.slope)*180/Math.PI : 90;
        if (deg>30) set(i,255,59,48,225); else if (deg>20) set(i,255,159,10,205); else if (deg>10) set(i,255,225,77,160);
      }
    }
    overlayContext.putImageData(image, 0, 0);
    overlayTexture.needsUpdate = true;
    redraw = true;
  }

  function setLayer(layer, on=true) {
    const next = on ? layer : (layer===null || state.layer===layer ? null : state.layer);
    if (next===state.layer) return;
    if (next) { state.layer = next; overlayDirty = true; overlayTarget = 1; }
    else overlayTarget = 0;
    for (const button of root.querySelectorAll('[data-layer]')) button.classList.toggle('on', button.dataset.layer===next);
    $('hudLegend').style.display = next ? 'block' : 'none';
    if (next) $('hudLegend').innerHTML = layers[next].legend;
    if (!next) pendingClear = true;
  }
  let pendingClear = false;

  // ---- base image for the minimap: the real terrain rendered from above ----
  const base = Object.assign(document.createElement('canvas'), {width:448, height:392});
  {
    const target = new THREE.WebGLRenderTarget(base.width, base.height);
    const top = new THREE.OrthographicCamera(-W/2, W/2, D/2, -D/2, 0.1, 300);
    top.up.set(0,0,1); top.position.set(W/2, 120, D/2); top.lookAt(W/2, 0, D/2);
    const hidden = scene.children.filter(child => child!==terrain && child.visible);
    const fog = scene.fog;
    hidden.forEach(child => child.visible = false); scene.fog = null;
    renderer.setRenderTarget(target); renderer.render(scene, top); renderer.setRenderTarget(null);
    hidden.forEach(child => child.visible = true); scene.fog = fog;
    const raw = new Uint8Array(base.width*base.height*4);
    renderer.readRenderTargetPixels(target, 0, 0, base.width, base.height, raw);
    const image = new ImageData(base.width, base.height);
    for (let y=0; y<base.height; y++) for (let x=0; x<base.width; x++) {
      const from = ((base.height-1-y)*base.width+x)*4, to = (y*base.width+x)*4;
      for (let k=0; k<3; k++) image.data[to+k] = 255*Math.pow(raw[from+k]/255, 1/2.2);
      image.data[to+3] = 255;
    }
    base.getContext('2d').putImageData(image, 0, 0);
    target.dispose();
  }

  // ---- route ribbon and destination beacon ----
  const ribbonMaterial = new THREE.MeshBasicMaterial({color:0x9ff6ff, transparent:true, opacity:0.85, depthWrite:false, side:THREE.DoubleSide, fog:false});
  const ribbon = new THREE.Mesh(new THREE.BufferGeometry(), ribbonMaterial);
  ribbon.frustumCulled = false; ribbon.visible = false; ribbon.renderOrder = 2;
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 5, 8),
    new THREE.MeshBasicMaterial({color:0x9ff6ff, transparent:true, opacity:0.75, depthWrite:false, fog:false}));
  beacon.visible = false;
  scene.add(ribbon, beacon);

  function drawRibbon(dense) {
    const half = 0.045, positions = new Float32Array(dense.length*6), index = [];
    for (let i=0; i<dense.length; i++) {
      const a = dense[Math.max(0,i-1)], b = dense[Math.min(dense.length-1,i+1)];
      const length = Math.hypot(b[0]-a[0], b[2]-a[2]) || 1;
      const nx = -(b[2]-a[2])/length*half, nz = (b[0]-a[0])/length*half;
      const [x,,z] = dense[i], y = (ground.sample(x,z)?.height ?? dense[i][1])+0.06;
      positions.set([x+nx,y,z+nz, x-nx,y,z-nz], i*6);
      if (i) index.push(2*i-2,2*i-1,2*i, 2*i-1,2*i+1,2*i);
    }
    ribbon.geometry.dispose();
    ribbon.geometry = new THREE.BufferGeometry();
    ribbon.geometry.setAttribute('position', new THREE.BufferAttribute(positions,3));
    ribbon.geometry.setIndex(index);
    ribbon.visible = true;
    const end = dense[dense.length-1];
    beacon.position.set(end[0], (ground.sample(end[0],end[2])?.height ?? end[1])+2.5, end[2]);
    beacon.visible = true;
    redraw = true;
  }

  // ---- alerts, speech ----
  let alertTimer;
  function alert(text, {warn=false, speak=true}={}) {
    const box = $('hudAlert');
    box.textContent = text; box.className = 'alert on'+(warn ? ' warn' : '');
    state.lastAlert = text;
    clearTimeout(alertTimer);
    alertTimer = setTimeout(() => box.classList.remove('on'), 7000);
    if (speak && !state.muted && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
      speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(text), {rate:1.05}));
    }
  }

  // ---- navigation ----
  const player = () => state.mapMode && saved ? [saved.position.x, saved.position.z] : [camera.position.x, camera.position.z];
  const clock = seconds => Math.floor(seconds/60)+':'+String(Math.round(seconds%60)).padStart(2,'0');

  function navigate(landmark, {quiet=false}={}) {
    const from = player();
    let best, error;
    for (const goal of landmark.viewing ?? [landmark.position]) {
      const result = nav.plan(from, goal);
      if (result.error) { error = result.error; continue; }
      if (!best || result.time<best.time) best = {...result, goal};
    }
    if (!best) { clearRoute(); alert(error, {warn:true}); return false; }
    let total = 0;
    best.cumulative = best.dense.map((p,i) => i ? total += Math.hypot(p[0]-best.dense[i-1][0], p[2]-best.dense[i-1][2]) : 0);
    best.progress = 0; best.landmark = landmark;
    state.route = best; state.goalName = landmark.name;
    drawRibbon(best.dense);
    $('hudCard').style.display = 'none';
    if (!quiet) {
      const viewing = landmark.viewing ? ' (viewing point)' : '';
      alert('Route to '+landmark.name+viewing+': '+best.distance.toFixed(1)+' m, about '+clock(best.time)+'. '+best.reason+
        (best.usesPrior ? ' Part of it is on the unsurveyed prior map.' : ''));
    }
    return true;
  }

  function clearRoute() {
    state.route = null; state.goalName = null;
    ribbon.visible = beacon.visible = false; redraw = true;
  }

  function showCard(landmark) {
    const card = $('hudCard');
    card.innerHTML = '<h3>'+landmark.name+'</h3><p>'+(landmark.science ?? 'Waypoint on the Skinner Ridge patch. Team label, not a NASA feature name.')+'</p>'+
      (landmark.link ? '<p><a target="_blank" rel="noopener" href="'+landmark.link+'">'+landmark.linkText+'</a></p>' : '')+
      '<p><span class="tag">OBSERVATION</span> NASA/JPL-Caltech Navcam</p>';
    card.style.display = 'block';
  }

  function follow() {
    const r = state.route;
    if (!r) return;
    const [x,z] = player();
    let bestD = Infinity, bestI = r.progress;
    for (let i=Math.max(0,r.progress-5); i<Math.min(r.dense.length, r.progress+80); i++) {
      const d = Math.hypot(r.dense[i][0]-x, r.dense[i][2]-z);
      if (d<bestD) { bestD = d; bestI = i; }
    }
    r.progress = bestI; r.off = bestD;
    const end = r.dense[r.dense.length-1];
    if (Math.hypot(end[0]-x, end[2]-z)<config.arrive) {
      const landmark = r.landmark;
      clearRoute();
      alert('Arrived at '+landmark.name+'.');
      showCard(landmark);
      return;
    }
    if (bestD>config.offRoute) { if (navigate(r.landmark, {quiet:true})) alert('Off route. Re-planned to '+r.landmark.name+'.'); }
  }

  let lastScanAt = [-99,-99], lastReroute = -1e9;
  function scanStep() {
    const [x,z] = [camera.position.x, camera.position.z];
    if (Math.hypot(x-lastScanAt[0], z-lastScanAt[1])<0.25) return;
    lastScanAt = [x,z];
    const fresh = nav.scan(x, z, camera.position.y);
    if (!fresh) return;
    if (state.layer==='hazard' || state.layer==='scan') overlayDirty = true;
    const r = state.route;
    if (r) {
      const block = nav.firstBlock(r.dense, r.progress);
      if (block) {
        const landmark = r.landmark, ahead = Math.hypot(block.x-x, block.z-z);
        if (navigate(landmark, {quiet:true})) {
          // Announce the first correction; later ones in quick succession update the display quietly.
          const now = performance.now(), recent = now-lastReroute<12000;
          lastReroute = now;
          alert('Scanner found '+block.what+' '+ahead.toFixed(1)+' m ahead that the prior map missed. Re-routed: '+
            state.route.distance.toFixed(1)+' m to go.', {warn:true, speak:!recent});
        } else alert('Scanner found '+block.what+' blocking the route. No other walkable route to '+landmark.name+'.', {warn:true});
      }
    }
  }

  let lastProximity = 0, lastSpot = null;
  function proximity(now) {
    // Warn only about what lies in the direction of travel, and not while a route is steering around it.
    const [x,z] = player(), was = lastSpot;
    lastSpot = [x,z];
    if (!was || now-lastProximity<8000 || state.route) return;
    const moved = Math.hypot(x-was[0], z-was[1]);
    if (moved<0.08) return;
    const fx = (x-was[0])/moved, fz = (z-was[1])/moved;
    const hit = nav.clear(ground, x, z, x+fx*2.2, z+fz*2.2);
    if (hit && hit.t*2.2<1.6 && hit.t*2.2>0.25) {
      lastProximity = now;
      alert('Caution: '+nav.describeBlock(hit.x,hit.z)+' '+(hit.t*2.2).toFixed(1)+' m ahead.', {warn:true});
    }
  }

  let returnPlan = null, returnAt = [-99,-99];
  function safeReturn() {
    const [x,z] = player();
    if (Math.hypot(x-returnAt[0], z-returnAt[1])>0.6 || !returnPlan) {
      returnAt = [x,z];
      const result = nav.plan([x,z], spawn);
      returnPlan = result.error ? null : result;
    }
    const budget = config.evaBudgetMin*60, usable = budget*(1-config.reserve);
    const back = returnPlan ? returnPlan.time : 0, margin = usable-state.eva-back;
    $('hudReturn').textContent = returnPlan ? clock(back)+' back · margin '+(margin<0 ? '-' : '')+clock(Math.abs(margin)) : 'no route';
    $('hudGauge').style.width = Math.max(0, Math.min(100, 100*margin/usable))+'%';
    $('hudGauge').style.background = margin<usable*0.2 ? '#ffb347' : '#6fd6e6';
    if (margin<0 && !warned) {
      warned = true;
      alert('Turn back now. Walking back to the start takes '+clock(back)+', which eats into the reserve.', {warn:true});
    }
  }

  // ---- planning view: oblique camera over the terrain ----
  let saved = null, flight = null;
  const orbit = {azimuth:Math.PI, elevation:0.62, radius:30};
  const center = new THREE.Vector3(W/2, 1, D*0.48);
  const lookHelper = new THREE.Object3D();
  function orbitPose() {
    const flat = Math.cos(orbit.elevation)*orbit.radius;
    const position = new THREE.Vector3(center.x+Math.sin(orbit.azimuth)*flat, center.y+Math.sin(orbit.elevation)*orbit.radius, center.z+Math.cos(orbit.azimuth)*flat);
    lookHelper.position.copy(position); lookHelper.up.set(0,1,0); lookHelper.lookAt(center);
    // Object3D.lookAt points +Z at the target; cameras look down -Z.
    const q = lookHelper.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI));
    return {position, quaternion:q};
  }
  function fly(to, seconds, done) {
    flight = {from:{position:camera.position.clone(), quaternion:camera.quaternion.clone()}, to, seconds, t:0, done, start:performance.now()};
  }
  function enterMap() {
    if (state.mapMode) return;
    saved = {position:camera.position.clone(), rotation:camera.rotation.clone()};
    state.mapMode = true;
    if (document.pointerLockElement) document.exitPointerLock();
    fly(orbitPose(), 1.4);
    document.body.classList.add('mapmode');
    for (const button of root.querySelectorAll('[data-map]')) button.classList.add('on');
    $('hudHeard').textContent = 'Planning view: click the terrain or a label to set a destination. Drag to orbit, scroll to zoom. M or Enter terrain to walk.';
  }
  function exitMap() {
    if (!state.mapMode || !saved) return;
    const q = new THREE.Quaternion().setFromEuler(saved.rotation);
    fly({position:saved.position.clone(), quaternion:q}, 1.2, () => {
      camera.position.copy(saved.position); camera.rotation.copy(saved.rotation);
      state.mapMode = false; saved = null;
    });
    document.body.classList.remove('mapmode');
    for (const button of root.querySelectorAll('[data-map]')) button.classList.remove('on');
    $('hudHeard').textContent = '';
  }
  document.addEventListener('pointerlockchange', () => { if (isLocked() && state.mapMode) exitMap(); });

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
    orbit.radius = Math.min(70, Math.max(10, orbit.radius*(event.deltaY>0 ? 1.1 : 0.9)));
    const pose = orbitPose(); camera.position.copy(pose.position); camera.quaternion.copy(pose.quaternion); redraw = true;
  }, {passive:true});

  function pick(clientX, clientY) {
    const ndc = new THREE.Vector3(clientX/innerWidth*2-1, -(clientY/innerHeight)*2+1, 0.5).unproject(camera);
    const direction = ndc.sub(camera.position).normalize();
    for (let t=0; t<140; t+=0.08) {
      const x = camera.position.x+direction.x*t, y = camera.position.y+direction.y*t, z = camera.position.z+direction.z*t;
      const s = ground.sample(x,z);
      if (s && y<=s.height) {
        navigate({id:'waypoint', name:'Map waypoint', aliases:[], position:[x,z], face:[x,z]});
        return;
      }
    }
    alert('That point is outside the mapped terrain.', {speak:false});
  }

  const labels = landmarks.map(landmark => {
    const element = Object.assign(document.createElement('div'), {className:'label', textContent:landmark.name});
    element.onclick = () => navigate(landmark);
    root.appendChild(element);
    return {landmark, element, point:new THREE.Vector3(landmark.position[0], (ground.sample(...landmark.position)?.height ?? 0)+0.3, landmark.position[1])};
  });
  const projected = new THREE.Vector3();
  function placeLabels() {
    for (const {element, point} of labels) {
      if (!state.mapMode || flight) { element.style.display = 'none'; continue; }
      projected.copy(point).project(camera);
      element.style.display = projected.z<1 ? 'block' : 'none';
      element.style.left = (projected.x+1)/2*innerWidth+'px';
      element.style.top = (1-projected.y)/2*innerHeight+'px';
    }
  }

  // ---- commands: typing, buttons and speech share this one entry point ----
  function command(text) {
    const parsed = parseCommand(text, landmarks);
    $('hudHeard').textContent = '“'+text+'”';
    if (parsed.type==='goto') navigate(parsed.landmark);
    else if (parsed.type==='choose') alert('Did you mean: '+parsed.options.map(option => option.name).join(' or ')+'?', {speak:false});
    else if (parsed.type==='clear') { clearRoute(); alert('Route cleared.'); }
    else if (parsed.type==='layer') { setLayer(parsed.layer, parsed.on); alert(parsed.on ? layers[parsed.layer].name+' highlight on.' : 'Highlight off.', {speak:false}); }
    else if (parsed.type==='map') enterMap();
    else if (parsed.type==='walk') ctx.enterButton.click();
    else if (parsed.type==='mute') { state.muted = parsed.on; if (parsed.on) window.speechSynthesis?.cancel(); alert(parsed.on ? 'Voice callouts muted.' : 'Voice callouts on.', {speak:false}); }
    else if (parsed.type==='unknown') alert(parsed.message, {speak:false});
    return parsed.type;
  }

  const buttons = $('hudButtons');
  for (const [id, layer] of Object.entries(layers)) {
    const button = Object.assign(document.createElement('button'), {textContent:layer.key+' '+layer.name});
    button.dataset.layer = id;
    button.onclick = () => setLayer(id, state.layer!==id || overlayTarget===0);
    buttons.appendChild(button);
  }
  const extra = (text, attribute, action) => {
    const button = Object.assign(document.createElement('button'), {textContent:text, onclick:action});
    if (attribute) button.dataset[attribute] = '1';
    buttons.appendChild(button);
    return button;
  };
  extra('M Map', 'map', () => state.mapMode ? exitMap() : enterMap());
  extra('C Clear route', null, () => command('clear route'));
  const muteButton = extra('N Mute', null, () => { command(state.muted ? 'unmute' : 'mute'); muteButton.classList.toggle('on', state.muted); });
  for (const landmark of landmarks.filter(l => l.id!=='start')) extra('→ '+landmark.name, 'dest', () => navigate(landmark));

  const input = $('hudCmd');
  input.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key==='Enter' && input.value.trim()) { command(input.value.trim()); input.value = ''; input.blur(); }
    if (event.key==='Escape') input.blur();
  });
  input.addEventListener('keyup', event => event.stopPropagation());

  // Speech: push-to-talk. Chrome's recogniser sends audio to an online service, so it only runs while V is held.
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = $('hudMic');
  let recogniser = null, listening = false, heard = '';
  if (!Recognition) { mic.disabled = true; mic.textContent = 'Voice unavailable'; mic.title = 'This browser has no speech recognition. Typing works.'; }
  else mic.title = 'Hold V to speak. Chrome sends the audio to its online speech service; typing works without it.';
  function listen(on) {
    if (!Recognition || on===listening) return;
    listening = on;
    mic.classList.toggle('on', on);
    if (on) {
      heard = '';
      recogniser = Object.assign(new Recognition(), {lang:'en-US', interimResults:true, continuous:true});
      recogniser.onresult = event => {
        heard = Array.from(event.results, result => result[0].transcript).join(' ');
        $('hudHeard').textContent = '🎙 “'+heard+'”';
      };
      recogniser.onerror = event => {
        const why = {'not-allowed':'Microphone permission was denied.', 'network':'Speech recognition needs a network connection in this browser.',
          'service-not-allowed':'Speech recognition is not allowed in this browser.'}[event.error];
        if (why) alert(why+' Typing still works.', {speak:false});
      };
      recogniser.onend = () => { if (heard.trim()) command(heard.trim()); mic.classList.remove('on'); listening = false; };
      try { recogniser.start(); $('hudHeard').textContent = '🎙 listening…'; } catch { listening = false; }
    } else recogniser?.stop();
  }
  mic.onpointerdown = () => listen(true);
  mic.onpointerup = mic.onpointerleave = () => listen(false);

  addEventListener('keydown', event => {
    if (event.target===input || event.repeat && event.code!=='KeyV') return;
    const layer = Object.entries(layers).find(([,l]) => event.key===l.key);
    if (layer) setLayer(layer[0], state.layer!==layer[0] || overlayTarget===0);
    else if (event.code==='KeyM') state.mapMode ? exitMap() : enterMap();
    else if (event.code==='KeyC') command('clear route');
    else if (event.code==='KeyN') muteButton.click();
    else if (event.code==='KeyV') listen(true);
    else if (event.code==='KeyT') { event.preventDefault(); if (document.pointerLockElement) document.exitPointerLock(); input.focus(); }
  });
  addEventListener('keyup', event => { if (event.code==='KeyV') listen(false); });

  // ---- drawing ----
  const toMap = (x,z,w,h) => [(1-x/W)*w, (1-z/D)*h];
  function drawMini(yaw) {
    const {width:w, height:h} = mini.canvas;
    mini.drawImage(base, 0, 0, w, h);
    if (state.layer && overlayFade>0.02) {
      mini.save(); mini.globalAlpha = 0.75*overlayFade; mini.translate(w,h); mini.scale(-w/nav.cols, -h/nav.rows);
      mini.drawImage(overlayCanvas, 0, 0); mini.restore();
    }
    if (state.route) {
      mini.beginPath();
      state.route.dense.forEach(([x,,z],i) => { const [mx,my] = toMap(x,z,w,h); i ? mini.lineTo(mx,my) : mini.moveTo(mx,my); });
      mini.strokeStyle = '#000a'; mini.lineWidth = 4; mini.stroke();
      mini.strokeStyle = '#9ff6ff'; mini.lineWidth = 2; mini.stroke();
    }
    mini.font = '9px ui-monospace,monospace';
    for (const landmark of landmarks) {
      const [mx,my] = toMap(...landmark.position, w, h);
      mini.fillStyle = landmark.name===state.goalName ? '#9ff6ff' : '#fff';
      mini.beginPath(); mini.arc(mx,my,2.5,0,7); mini.fill();
    }
    const [x,z] = player(), [px,py] = toMap(x,z,w,h);
    const bearing = Math.atan2(Math.sin(yaw), -Math.cos(yaw));
    mini.save(); mini.translate(px,py); mini.rotate(bearing);
    mini.beginPath(); mini.moveTo(0,-8); mini.lineTo(5,6); mini.lineTo(0,3); mini.lineTo(-5,6); mini.closePath();
    mini.fillStyle = '#ffd60a'; mini.strokeStyle = '#000'; mini.lineWidth = 1; mini.fill(); mini.stroke(); mini.restore();
    mini.fillStyle = '#fff'; mini.fillText('N', w-12, 12);
  }

  function drawTape(yaw) {
    const {width:w, height:h} = tape.canvas, bearing = (Math.atan2(Math.sin(yaw), -Math.cos(yaw))*180/Math.PI+360)%360;
    tape.clearRect(0,0,w,h);
    tape.fillStyle = '#0a1114b8'; tape.fillRect(0,0,w,h);
    tape.strokeStyle = tape.fillStyle = '#bff6ff'; tape.font = '11px ui-monospace,monospace'; tape.textAlign = 'center';
    const scale = w/120;
    for (let d=Math.ceil((bearing-60)/5)*5; d<=bearing+60; d+=5) {
      const x = w/2+(d-bearing)*scale, deg = (d+360)%360;
      tape.beginPath(); tape.moveTo(x,h); tape.lineTo(x, h-(deg%15 ? 5 : 10)); tape.stroke();
      if (deg%45===0) tape.fillText(['N','NE','E','SE','S','SW','W','NW'][deg/45], x, 14);
      else if (deg%15===0) tape.fillText(String(deg), x, 14);
    }
    if (state.route) {
      const [x,z] = player(), r = state.route, aim = r.dense[Math.min(r.dense.length-1, r.progress+12)];
      let delta = (Math.atan2(-(aim[0]-x), aim[2]-z)*180/Math.PI-bearing+540)%360-180;
      delta = Math.max(-58, Math.min(58, delta));
      tape.fillStyle = '#ffd60a';
      tape.beginPath(); tape.moveTo(w/2+delta*scale, h-12); tape.lineTo(w/2+delta*scale-6, h); tape.lineTo(w/2+delta*scale+6, h); tape.fill();
    }
    tape.strokeStyle = '#fff'; tape.beginPath(); tape.moveTo(w/2,h); tape.lineTo(w/2,h-16); tape.stroke();
    $('hudHeading').textContent = String(Math.round(bearing)%360).padStart(3,'0')+'°';
  }

  let sweep = 0;
  function drawRadar(yaw, dt) {
    const {width:w} = radar.canvas, half = w/2, range = config.scanRange, scale = half/range;
    radar.clearRect(0,0,w,w);
    radar.fillStyle = '#06181c'; radar.beginPath(); radar.arc(half,half,half-1,0,7); radar.fill();
    radar.strokeStyle = '#6fd6e655';
    for (const r of [2,4,6]) { radar.beginPath(); radar.arc(half,half,r*scale,0,7); radar.stroke(); }
    const [x,z] = player(), fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const c0 = Math.floor(x/nav.cell), r0 = Math.floor(z/nav.cell), span = Math.ceil(range/nav.cell);
    for (let r=r0-span; r<=r0+span; r++) for (let c=c0-span; c<=c0+span; c++) {
      if (c<0 || r<0 || c>=nav.cols || r>=nav.rows) continue;
      const i = r*nav.cols+c;
      if (!nav.scanned[i] || nav.okTruth[i]) continue;
      const dx = (c+0.5)*nav.cell-x, dz = (r+0.5)*nav.cell-z, ahead = dx*fx+dz*fz, side = dx*rx+dz*rz;
      const distance = Math.hypot(ahead,side);
      if (distance>range) continue;
      radar.fillStyle = distance<1.6 && ahead>0 ? '#ff3b30' : '#ffb347';
      radar.fillRect(half+side*scale-1, half-ahead*scale-1, 2.4, 2.4);
    }
    sweep = (sweep+dt*2.4)%(2*Math.PI);
    radar.strokeStyle = '#9ff6ff88'; radar.beginPath(); radar.moveTo(half,half);
    radar.lineTo(half+Math.sin(sweep)*half, half-Math.cos(sweep)*half); radar.stroke();
    radar.fillStyle = '#ffd60a'; radar.beginPath(); radar.moveTo(half,half-6); radar.lineTo(half+4,half+4); radar.lineTo(half-4,half+4); radar.fill();
  }

  // ---- per-frame update. Returns true when the 3D view must be redrawn. ----
  let slow = 0, medium = 0;
  function update(dt, now, yaw) {
    if (flight) {
      flight.t = Math.min(1, (performance.now()-flight.start)/1000/flight.seconds);  // wall clock, so slow machines still arrive on time
      const k = flight.t*flight.t*(3-2*flight.t);
      camera.position.lerpVectors(flight.from.position, flight.to.position, k);
      camera.quaternion.slerpQuaternions(flight.from.quaternion, flight.to.quaternion, k);
      redraw = true;
      if (flight.t===1) { const done = flight.done; flight = null; done?.(); }
    }
    if (overlayFade!==overlayTarget) {
      overlayFade += Math.sign(overlayTarget-overlayFade)*Math.min(Math.abs(overlayTarget-overlayFade), dt/0.5);
      uniforms.overlayOpacity.value = overlayFade; redraw = true;
      if (overlayFade===0 && pendingClear) { pendingClear = false; state.layer = null; }
    }
    if (overlayDirty && state.layer) paintOverlay();
    if (isLocked() && !state.mapMode) state.eva += dt;
    medium += dt; slow += dt;
    if (medium>0.2) {
      medium = 0;
      if (!state.mapMode) { scanStep(); proximity(now); }
      follow();
      const [x,z] = player(), s = ground.sample(x,z);
      $('hudSlope').textContent = s ? Math.round(Math.atan(s.slope)*180/Math.PI)+'°' : '–';
      $('hudGround').textContent = nav.inferredAt(x,z) ? 'inferred fill' : 'rover-measured';
      $('hudGround').style.color = nav.inferredAt(x,z) ? '#f59e0b' : '#2dd4bf';
      let seen = 0; for (let i=0; i<nav.scanned.length; i++) seen += nav.scanned[i];
      $('hudScan').textContent = Math.round(100*seen/nav.scanned.length)+'% of patch';
      const r = state.route;
      if (r) {
        const left = r.distance-r.cumulative[r.progress];
        $('hudRoute').textContent = state.goalName+' · '+left.toFixed(1)+' m';
        $('hudEta').textContent = clock(r.time*left/Math.max(r.distance,0.01));
      } else { $('hudRoute').textContent = 'none'; $('hudEta').textContent = '–'; }
    }
    if (slow>1) { slow = 0; safeReturn(); }
    drawTape(yaw); drawMini(yaw); drawRadar(yaw, dt); placeLabels();
    const result = redraw; redraw = false;
    return result;
  }

  return {update, command, navigate, state, nav, landmarks, enterMap, exitMap, setLayer, camera,
    get flying() { return !!flight; }};
}
