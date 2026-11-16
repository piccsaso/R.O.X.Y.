// This code was generated through the use of SI.
import {createSpeech} from './speech.mjs';
// Helmet HUD for the Skinner Ridge walk: compass, minimap, suit gauge,
// destination pin, route lines, return warning, planning view, voice.
import {makeNav, makeLandmarks, parseCommand, matchRoxyWake, selectVoiceTranscript, config} from './nav.mjs';
import {overlayLayers, overlayPixel, slopeDegrees, elevationRange} from './overlays.mjs';

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
#hud .legend{top:82px;left:50%;transform:translateX(-50%);width:max-content;max-width:calc(100vw - 520px);padding:6px 10px;white-space:normal;letter-spacing:.02em;text-transform:none;font-size:11px;line-height:1.5;pointer-events:none;text-align:center;background:#151c25b8;border:0;border-radius:0;z-index:4}
#hud .legend strong{display:block;font-size:13px}
#hud .legend span{display:inline-block;margin:0 4px}
#hud .legend .swatches{display:flex;flex-wrap:wrap;justify-content:center;gap:4px}
#hud .legend i{margin:0 4px 0 0}
#hud .mini canvas[hidden]{display:none}
#hud .mini .orbital-map{position:relative;width:224px;height:224px;background:#090e16}
#hud .mini .orbital-map img{display:block;width:100%;height:100%;image-rendering:pixelated}
#hud .mini .orbital-map b{position:absolute;width:10px;height:10px;transform:translate(-50%,-50%);border:2px solid white;border-radius:50%;box-shadow:0 1px 3px #000}
#hud .menu{max-height:65dvh;overflow-y:auto}
#hud .menu [role=button]:focus-visible{outline:2px solid #ffb454;outline-offset:-2px}
#hud .dock button:focus-visible{outline:2px solid #ffb454}
@media(max-width:700px){body:has(#hudLegend[style*="block"]) .sky-controls{display:none}}
@media(max-width:700px){#hud .legend{top:165px;max-width:calc(100vw - 24px);width:calc(100vw - 24px);font-size:10px}#hud .mini{top:12px;right:10px;transform:scale(.65);transform-origin:top right}#hud .compass{display:none}#hud .dock{bottom:10px;max-width:calc(100vw - 12px)}#hud .dock button{padding:12px 8px;font-size:9px;letter-spacing:.04em}#hud .menu{min-width:245px;white-space:normal}#hud .suit{transform:scale(.7);transform-origin:bottom left;bottom:62px}#hud .credit{display:none}}
`;

const launcherCss = `
#hud .dock,body.locked #hud .dock{display:block;bottom:18px;width:60px;height:60px;padding:0;border:0;background:none;backdrop-filter:none;-webkit-backdrop-filter:none;pointer-events:none;z-index:6}
#hud .dock .launcher{display:grid;place-items:center;position:absolute;inset:0;width:60px;height:60px;padding:0;border:1px solid #d5f4edb3;border-radius:50%;background:#18302b66;backdrop-filter:blur(3px);pointer-events:auto;box-shadow:0 5px 18px #0003;z-index:2;transition:background .25s,border-color .25s}
#hud .dock .launcher::after{display:none}
#hud .launcher-mark{display:block;width:22px;height:22px;border:1.5px solid #d5f4ed;border-radius:50%;position:relative;transition:transform .5s cubic-bezier(.16,1,.3,1)}
#hud .launcher-mark::after{content:"";position:absolute;inset:7px;border:1px solid #d5f4ed;border-radius:50%}
#hud .expanded .launcher-mark{transform:rotate(90deg) scale(.8)}
#hud .dock .launcher:hover,#hud .dock .launcher.listening{background:#73c9ba55;border-color:#defff9}
#hud .dock-items{position:absolute;bottom:43px;left:50%;display:flex;align-items:center;gap:2px;width:max-content;max-width:calc(100vw - 24px);padding:9px 12px 19px;border:1px solid #c9e9df70;border-radius:34px;background:#13272366;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);box-shadow:0 6px 20px #0002;transform:translate(-50%,35px) scale(.12,.45);transform-origin:50% 100%;opacity:0;visibility:hidden;pointer-events:none;transition:transform .48s cubic-bezier(.16,1,.3,1),opacity .2s,visibility 0s .48s}
#hud .dock.expanded .dock-items{transform:translate(-50%,0) scale(1);opacity:1;visibility:visible;pointer-events:auto;transition-delay:0s}
#hud .dock-items>button,#hud .dock-items>.wrap>button{border-radius:22px;padding:11px 18px;white-space:nowrap}
#hud .dock-items .menu{border-radius:16px;background:#162c268c;backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
#hud .dock-items .menu div{border-radius:12px}
#hud .mini,#hud .mini.regional{border-radius:14px;border-color:#c5f2eb99;box-shadow:0 5px 20px #0003}
#hud .mini.regional .orbital-map{border-radius:13px;overflow:hidden;background:#090e1633}
#hud .suit{width:194px;padding:10px 12px;background:#16272330;border-radius:18px}
#hud .suit canvas{width:150px;height:auto;margin:0 auto;display:block}
#hud .eva-data{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;margin:3px 2px 12px;text-transform:none;letter-spacing:.03em}
#hud .eva-data span{display:flex;flex-direction:column;gap:3px;font-size:9px;color:#d6e7df}
#hud .eva-data b{font-size:13px;font-weight:600;color:#f4efe6;font-variant-numeric:tabular-nums}
#hud .suit .coords{font-size:8px;letter-spacing:.04em;line-height:1.7}
#hud .ear{display:block;pointer-events:auto;top:252px;padding:6px 10px;border-radius:12px;background:#16272340;font-size:10px;letter-spacing:.05em;max-width:224px;white-space:normal;text-align:right}
#hud .ear::before{display:none}#hud .ear.on::before{display:inline-block}
@media(max-width:700px){#hud .suit{width:156px;padding:8px 10px;transform:none;left:12px;bottom:145px}#hud .suit canvas{width:112px}#hud .eva-data{gap:8px 18px;margin-bottom:8px}#hud .eva-data b{font-size:12px}#hud .ear{top:162px;right:12px;max-width:180px;font-size:9px}#hud .legend{top:200px}}
#hud .legend{background:#13231d38;border-radius:16px;text-shadow:0 1px 3px #000,0 0 2px #000}
#hud .return{background:#9c20145c;border-radius:16px;text-shadow:0 1px 3px #000}
#hud .note{padding:6px 12px;border-radius:16px;background:#13231d26;text-shadow:0 1px 3px #000}
#hud .roxy{bottom:132px}
#hud .roxy .orb{display:none}
#hud .roxy{max-width:min(440px,calc(100vw - 28px));padding:8px 12px;background:#16272340;border-radius:14px;text-align:center;gap:4px}
#hud .roxy span{font-size:12px;line-height:1.45;overflow-wrap:anywhere}
@media(max-width:700px){#hud .dock-items{padding:7px 8px 19px;gap:0}#hud .dock-items>button,#hud .dock-items>.wrap>button{padding:10px 6px;font-size:9px;letter-spacing:.025em}#hud .dock{bottom:12px}#hud .roxy{bottom:155px;left:auto;right:12px;transform:none;width:calc(100vw - 202px);text-align:center}}
@media(prefers-reduced-motion:reduce){#hud .dock-items,#hud .launcher-mark{transition:none}}
#hud .map-stack{position:absolute;top:18px;right:20px;width:226px;display:flex;flex-direction:column;gap:8px}
#hud .map-stack .mini{position:relative;top:auto;right:auto;transform:none;width:100%;box-sizing:border-box}
#hud .map-stack .mini canvas{width:100%;height:auto}
#hud .map-stack .orbital-map{width:100%;height:auto;aspect-ratio:1}
#hud .map-stack .legend{position:static;transform:none;width:auto;max-width:none;padding:8px 10px;text-align:left;line-height:1.4}
#hud .map-stack .legend .swatches{justify-content:flex-start;gap:5px 8px;margin-top:5px}
#hud .map-stack .legend span{margin:0}
#hud .map-stack .ear{position:static;align-self:flex-end;max-width:100%}
@media(max-width:700px){#hud .map-stack{top:12px;right:10px;width:clamp(146px,42vw,190px)}#hud .map-stack .legend{font-size:10px;padding:7px 8px}#hud .map-stack .legend strong{font-size:11px}#hud .weather-alert{top:max(255px,calc(var(--map-stack-bottom,200px) + 12px))}}
`;

const html = `
<div class="vignette"></div><div class="flash" id="hudFlash"></div>
<div class="compass"><canvas width="640" height="46"></canvas><span class="bearing" id="hudBearing">000</span></div>
<div class="map-stack"><div class="mini"><canvas width="224" height="204"></canvas></div>
<div class="legend" id="hudLegend"></div>
<button class="ear" id="hudEar" aria-pressed="false">Enable Roxy · V</button>
</div>
<div class="suit"><canvas width="250" height="236"></canvas><div class="eva-data"><span>Oxygen<b id="evaO2"></b></span><span>Power<b id="evaPower"></b></span><span>Heart rate<b id="evaHeart"></b></span><span>Suit temp<b id="evaTemp"></b></span></div><div class="coords" id="hudCoords"></div></div>
<div class="note" id="hudNote"></div>
<div class="pin" id="hudPin"></div>
<div class="return" id="hudReturn"></div>
<div class="roxy" id="hudRoxy" role="status" aria-live="polite"><small id="hudRoxyLabel">Roxy</small><span id="hudHeard"></span></div>
<div class="type"><input id="hudCmd" placeholder="Type a command, then Enter" autocomplete="off"></div>
<div class="dock">
  <button id="hudLauncher" class="launcher" aria-label="Open Roxy controls" aria-expanded="false" aria-controls="hudDockItems" title="Roxy controls"><span class="launcher-mark" aria-hidden="true"></span></button>
  <div class="dock-items" id="hudDockItems" inert>
  <div class="wrap"><div class="menu" id="hudLayers"></div><button data-menu="hudLayers" aria-expanded="false">Overlays</button></div>
  <div class="wrap"><div class="menu" id="hudOptions"></div><button data-menu="hudOptions">Options</button></div>
  <div class="wrap"><div class="menu" id="hudRoutes"></div><button data-menu="hudRoutes">Routes</button></div>
  <button id="hudReset">Reset position</button>
  </div>
</div>
<div class="credit">Terrain NASA/JPL-Caltech Navcam · includes inferred terrain · suit telemetry simulated</div>`;

const legends = {
  slope:'<i style="background:#ffe14d"></i>15–25° <i style="background:#ff9f0a"></i>25–35° <i style="background:#ff3b30"></i>over 35° · slope over 0.8 m, derived from the terrain',
  truth:'<i style="background:#7ddc6f"></i>rover-measured <i style="background:#ff9628"></i>inferred / partial support <i style="background:#9a98a8"></i>context terrain (not measured)'
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
    // Only 235 marks both triangles supported; 169 is partial support.
    return coverage.data[(row*coverage.width+col)*4]===235 ? 0 : 1;
  };

  document.head.appendChild(Object.assign(document.createElement('style'), {textContent:css+launcherCss}));
  const root = Object.assign(document.createElement('div'), {id:'hud', innerHTML:html});
  document.body.appendChild(root);
  const mapStack=root.querySelector('.map-stack');
  const placeMapStack=()=>root.style.setProperty('--map-stack-bottom',mapStack.getBoundingClientRect().bottom+'px');
  const mapObserver=new ResizeObserver(placeMapStack);mapObserver.observe(mapStack);
  addEventListener('resize',placeMapStack);
  addEventListener('pagehide',()=>{mapObserver.disconnect();removeEventListener('resize',placeMapStack);});
  const small = document.querySelector('header small'); if (small) small.textContent = 'Jezero Crater · Mars';
  const $ = id => root.querySelector('#'+id);
  const dock = root.querySelector('.dock');
  function setDockOpen(open) {
    const returnFocus=!open && $('hudDockItems').contains(document.activeElement);
    dock.classList.toggle('expanded',open);
    $('hudDockItems').inert=!open;
    $('hudLauncher').setAttribute('aria-expanded',String(open));
    $('hudLauncher').setAttribute('aria-label',open?'Close Roxy controls':'Open Roxy controls');
    if(!open) {
      arm(false);
      closeMenus();
      root.dispatchEvent(new Event('dockcollapse'));
      if(returnFocus)$('hudLauncher').focus();
    }
  }
  $('hudLauncher').onclick=()=>{const open=!dock.classList.contains('expanded');if(open && roxy.enabled){cancelReply();arm(true);}else setDockOpen(open);};
  const tape = root.querySelector('.compass canvas').getContext('2d');
  const mini = root.querySelector('.mini canvas').getContext('2d');
  const suit = root.querySelector('.suit canvas').getContext('2d');

  const state = {layer:null, mapMode:false, muted:false, show:{straight:true, safe:true, custom:false}, cleared:false,
    goal:summit, custom:null, routes:{}, o2:1, power:1, heart:74, temp:21.4, eva:0, warning:false, lastNote:''};
  let redraw = true, overlayFade = 0, overlayTarget = 0, overlayDirty = false, pendingClear = false;
  const overlayStrength = .8;
  let weatherHazards={dust:0,particles:false};
  const range = elevationRange(nav,support);
  let mineralSample=null,mineralFailed=false;
  const mineralImage=new Image();
  mineralImage.onload=()=>{
    const sampleCanvas=document.createElement('canvas');sampleCanvas.width=mineralImage.naturalWidth;sampleCanvas.height=mineralImage.naturalHeight;
    const context=sampleCanvas.getContext('2d');context.drawImage(mineralImage,0,0);
    const x=Math.floor(77.40616768/90*sampleCanvas.width),y=Math.floor((90-18.45889532)/90*sampleCanvas.height);
    mineralSample=Array.from(context.getImageData(x,y,1,1).data);
    if(state.layer==='minerals' && overlayTarget===1)setLayer('minerals',true);
  };
  mineralImage.onerror=()=>{mineralFailed=true;if(state.layer==='minerals' && overlayTarget===1)setLayer('minerals',true);};
  mineralImage.src=overlayLayers.minerals.image;

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
          vec2 overlayUV=(vOverlayXZ-overlayBox.xy)/overlayBox.zw;
          vec4 ov=texture2D(overlayMap,overlayUV);
          ov.a*=step(0.0,overlayUV.x)*step(0.0,overlayUV.y)*step(overlayUV.x,1.0)*step(overlayUV.y,1.0);
          float lum=dot(diffuseColor.rgb,vec3(0.3333));
          diffuseColor.rgb=mix(diffuseColor.rgb,ov.rgb*(0.22+1.25*lum),ov.a*overlayOpacity);`);
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
      if(state.layer==='minerals') {
        c=mineralSample && mineralSample[3]>0 && support(x,z)===0 && Number.isFinite(nav.height[i]) ? [...mineralSample.slice(0,3),150] : null;
      } else if (overlayLayers[state.layer]) {
        let observed=support(x,z);
        if(state.layer==='traffic' && observed===0) {
          const samples=[[x-.4,z],[x+.4,z],[x,z-.4],[x,z+.4]];
          for(let a=0;a<8;a++) samples.push([x+.16*Math.cos(a*Math.PI/4),z+.16*Math.sin(a*Math.PI/4)]);
          if(samples.some(p=>support(...p)!==0 || !Number.isFinite(ground.sample(...p)?.height))) observed=1;
        }
        c=overlayPixel(state.layer,{x,z,height:nav.height[i],slope:state.layer==='traffic' ? slopeDegrees(ground,x,z) : 0,unsafe:nav.unsafe[i],support:observed,range});
        if(state.layer==='traffic' && observed===0 && c[3]>0) {
          if(weatherHazards.particles && c[0]!==239) c=[225,101,180,195];
          else if(weatherHazards.dust && c[0]===69) c=[241,206,82,200];
        }
      } else if (state.layer==='slope') {
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
    if(layer!==null && !overlayLayers[layer] && !legends[layer]) return;
    const next = on ? layer : (state.layer===layer || layer===null ? null : state.layer);
    if (next) { state.layer = next; overlayDirty = true; overlayTarget = 1; pendingClear = false; }
    else { overlayTarget = 0; pendingClear = true; }
    $('hudLegend').style.display = next ? 'block' : 'none';
    const minimap = root.querySelector('.mini');
    minimap.classList.toggle('regional',!!overlayLayers[next]?.regional);
    minimap.querySelector('.orbital-map')?.remove();
    minimap.querySelector('canvas').hidden = false;
    if (next) {
      const definition = overlayLayers[next];
      $('hudLegend').innerHTML = definition
        ? `<strong>${definition.name}</strong><span>${definition.regional ? (next==='thermal' ? 'THEMIS night IR · regional · temperature uncalibrated' : 'TES clinopyroxene · regional · local detail unresolved') : definition.status}</span><div class="swatches">${definition.colors.map(([color,label]) => `<span><i style="background:${color}"></i>${label}</span>`).join('')}</div>`
        : legends[next];
      if(next==='minerals') {
        const colour=mineralSample ? `rgb(${mineralSample.slice(0,3).join(',')})` : '#9298a6';
        $('hudLegend').innerHTML=`<strong>Minerals · TES clinopyroxene</strong><span>Regional context tint · local variation unresolved</span><div class="swatches"><span><i style="background:${colour}"></i>${mineralFailed?'Observation unavailable':mineralSample ? (mineralSample[3] ? 'Native TES sample colour' : 'No data at reference location') : 'Loading observation…'}</span><span>Untinted: unverified terrain</span></div>`;
      }
      if (next === 'traffic' && weatherHazards.particles) {
        $('hudLegend').appendChild(Object.assign(document.createElement('span'), {
          textContent:'Magenta: simulated exposure caution · red: steep terrain · routes terrain-only'
        }));
      } else if (next === 'traffic' && weatherHazards.dust) {
        $('hudLegend').appendChild(Object.assign(document.createElement('span'), {
          textContent:'Yellow includes simulated dust visibility caution · routes terrain-only'
        }));
      }
      if (definition?.regional) {
        const span = 180 / 2 ** definition.zoom;
        const map = document.createElement('div');
        map.className = 'orbital-map';
        const image = Object.assign(document.createElement('img'), {
          src:definition.image, alt:definition.status + '; north is up'
        });
        image.onerror = () => { map.textContent = 'Observation unavailable'; };
        const marker = document.createElement('b');
        marker.style.left = (((77.40616768 + 180) / span - definition.col) * 100) + '%';
        marker.style.top = (((90 - 18.45889532) / span - definition.row) * 100) + '%';
        marker.title = 'Rover reference location';
        map.append(image,marker);
        minimap.querySelector('canvas').hidden = true;
        minimap.appendChild(map);
      }
    }
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
    note(window.speechSynthesis ? 'Using browser voice' : 'Voice unavailable');
  });
  addEventListener('pagehide', () => {roxy.enabled=false;clearTimeout(roxy.restart);stopRecogniser();speech.cancel();});
  // ---- notes and speech ----
  let noteTimer,voiceCommand=false;
  function note(text, {warn=false, speak=false}={}) {
    if(voiceCommand || speak){state.lastNote=text;caption('Roxy',text);if(speak)say(text);return;}
    const box = $('hudNote');
    box.textContent = text; box.style.color = warn ? '#ff6b5e' : INK; box.classList.add('on');
    state.lastNote = text;
    clearTimeout(noteTimer); noteTimer = setTimeout(() => box.classList.remove('on'), 5000);
    if (speak) say(text);
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
    state.custom = landmark; state.show.custom = true; state.show.safe = false; state.show.straight = false; state.cleared = false; arrived = null;
    plan('custom'); refreshLines(); buildMenus();
    const r = state.routes.custom;
    if (r) note('Route to '+landmark.name+'. '+Math.round(r.distance)+' meters.',{speak:true});
    else note("No route to " + landmark.name + ".", {speak:true});
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
      note('Arrived at '+target.name+'.',{speak:true});
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
        note('', {}); say('Warning. Return to Home Base now.');
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
  // Roxy starts enabled; browser microphone permission remains required.
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
    element.onclick = () => landmark===summit ? command('go to ridge summit') : setCustom(landmark);
    root.appendChild(element);
    return {element, landmark, point:new THREE.Vector3(landmark.position[0], heightAt(...landmark.position)+0.3, landmark.position[1])};
  });
  const projected = new THREE.Vector3();

  // ---- commands: typing, menus and speech share this ----
  const replyCounts = {};
  function reply(options, key = options[0]) {
    const index = replyCounts[key] || 0;
    replyCounts[key] = index + 1;
    note(options[index % options.length], {speak:true});
  }
  function command(text) {
    const request = text.replace(/^(?:(?:hey|hi)[, ]+)?(?:please\s+|(?:can|could|would) you\s+|i(?:'d| would) like (?:you )?to\s+)/i, '')
      .replace(/[, ]+please[.!?]*$/i, '').trim();

    const phrase = request.toLowerCase().replace(/[!?.,]/g, '').trim();
    const replies = {greeting:['Hello.'],thanks:["You're welcome."],check:['Listening.']};
    let kind;
    if (/^(hi|hello|hey|good morning|good afternoon)$/.test(phrase)) kind = 'greeting';
    if (/^(thanks|thank you|thanks a lot|thank you so much|cheers)$/.test(phrase)) kind = 'thanks';
    if (/^(are you there|can you hear me|hear me|you there)$/.test(phrase)) kind = 'check';
    if (kind) {
      reply(replies[kind]);
      return 'conversation';
    }
    if (/^(help|help me|what can you do|what can i say)$/.test(phrase)) {
      note('Try show trafficability, open overlays, or go to the slab.',{speak:true});
      return 'conversation';
    }
    if (/^(how are you|how are you doing)$/.test(phrase)) {
      note('Ready.',{speak:true});
      return 'conversation';
    }
    if (/^(repeat|say that again|repeat that|what did you say)$/.test(phrase)) {
      note(state.lastNote || "Listening.", {speak:true});
      return 'conversation';
    }
    if (/^(how much oxygen.*|oxygen status|check my oxygen)$/.test(phrase)) {
      note('Your simulated oxygen is at ' + Math.round(state.o2 * 100) + ' percent.' +
        (state.warning ? ' Head back to Home Base now.' : ''), {speak:true});
      return 'conversation';
    }
    const parsed = parseCommand(request, landmarks);
    if (parsed.type==='goto') {
      if (parsed.landmark===summit) { state.show.custom = false; state.show.safe = true; state.show.straight = false; state.cleared = false; arrived = null; replanAll(); buildMenus(); note(state.routes.safe ? "Route to Ridge summit." : "No route to Ridge summit.", {speak:true}); }
      else setCustom(parsed.landmark);
    } else if (parsed.type==='clear') { state.cleared = true; refreshLines(); note('Route cleared'); }
    else if (parsed.type==='layer') { const shown = state.layer===parsed.layer && overlayTarget===1; setLayer(parsed.layer, parsed.on==='toggle' ? !shown : parsed.on); closeMenus(); }
    else if (parsed.type==='route') {
      if (parsed.which==='custom' && !state.custom) note('No voice route yet. Say "take me to the slab".');
      else { const shown = state.show[parsed.which] && !state.cleared; state.show[parsed.which] = parsed.on==='toggle' ? !shown : parsed.on; state.cleared = false; replanAll(); buildMenus(); }
    }
    else if (parsed.type==='map') { const entering = !state.mapMode; entering ? enterMap() : exitMap(); note(entering ? 'Map open' : 'Map closed'); }
    else if (parsed.type==='close') { closeMenus(); if (state.mapMode) exitMap(); }
    else if (parsed.type==='reset') resetAll();
    else if (parsed.type==='menu') { setDockOpen(true); const button = root.querySelector('[data-menu=hud'+parsed.menu[0].toUpperCase()+parsed.menu.slice(1)+']'); if (document.pointerLockElement) document.exitPointerLock(); if (!$(button.dataset.menu).classList.contains('open')) button.click(); }
    else if (parsed.type==='mute') { state.muted = parsed.on==='toggle' ? !state.muted : parsed.on; if (state.muted) speech.cancel(); buildMenus(); }
    else if (parsed.type==='drain') { state.o2 = Math.min(state.o2, 0.24); checkReturn(); }
    else if (parsed.type==='unknown') note('Not understood. Try again, or press T to type.');
    return parsed.type;
  }

  // ---- the two menus ----
  function closeMenus() { for (const m of root.querySelectorAll('.menu')) m.classList.remove('open'); for (const b of root.querySelectorAll('[data-menu]')) {b.classList.remove('open');b.setAttribute('aria-expanded','false');} }
  function item(menu, text, on, action, {colour, disabled}={}) {
    const row = Object.assign(document.createElement('div'), {innerHTML:'<i></i>'+text});
    if (on) row.classList.add('on');
    if (disabled) row.classList.add('off');
    if (colour) row.style.setProperty('--tone', colour);
    row.tabIndex=disabled ? -1 : 0;row.setAttribute('role','button');row.setAttribute('aria-pressed',String(!!on));
    if(disabled)row.setAttribute('aria-disabled','true');
    row.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();row.click();}};
    row.onclick = event => { event.stopPropagation(); if (!disabled) action(); };
    menu.appendChild(row);
  }
  function buildMenus() {
    const options = $('hudOptions'), routes = $('hudRoutes');
    const layers=$('hudLayers'); layers.textContent='';
    item(layers,'Natural terrain',overlayTarget===0,()=>{setLayer(null,false);closeMenus();});
    for(const [key,layer] of Object.entries(overlayLayers)) item(layers,layer.name+(layer.regional?' · regional':''),state.layer===key && overlayTarget===1,()=>{setLayer(key,!(state.layer===key && overlayTarget===1));closeMenus();},{colour:layer.colors[0]?.[0] ?? '#a8e4ff'});
    options.textContent = routes.textContent = '';
    item(layers, 'Slope', state.layer==='slope' && overlayTarget===1, () => {setLayer('slope', !(state.layer==='slope' && overlayTarget===1));closeMenus();});
    item(layers, 'Ground truth', state.layer==='truth' && overlayTarget===1, () => {setLayer('truth', !(state.layer==='truth' && overlayTarget===1));closeMenus();});
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
    button.setAttribute('aria-expanded',String(open));
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
  const roxy = {enabled:false, armed:false, running:false, speaking:false, pending:false, recogniser:null, restart:null, speechTimer:null, speechId:0, networkFailures:0, status:''};
  function caption(label,text) {
    $('hudRoxyLabel').textContent=label;$('hudHeard').textContent=text;
    $('hudRoxy').classList.add('on');
  }
  function stopRecogniser() {
    const r=roxy.recogniser;roxy.recogniser=null;roxy.running=false;
    try {r?.abort();} catch {}
  }
  function cancelReply() {
    roxy.speechId++;clearTimeout(roxy.speechTimer);roxy.pending=false;roxy.speaking=false;speech.cancel();
    if(roxy.enabled)startRecogniser();
  }
  function say(text) {
    caption('Roxy',text);
    if (state.muted) return;
    const id=++roxy.speechId;
    roxy.speaking=false;
    roxy.pending=true;
    clearTimeout(roxy.speechTimer);
    const finish=()=>{
      if(id!==roxy.speechId)return;
      clearTimeout(roxy.speechTimer);roxy.speaking=false;roxy.pending=false;
      clearTimeout(roxy.restart);startRecogniser();
    };
    roxy.speechTimer=setTimeout(()=>{speech.cancel();finish();},15000);
    void speech.speak(text,finish,()=>{
      if(id!==roxy.speechId)return;
      roxy.pending=false;roxy.speaking=true;stopRecogniser();
      roxy.status='Roxy speaking · V to interrupt';refreshRoxy();
    });
    startRecogniser();
  }
  function arm(on) {
    if(on)setDockOpen(true);
    $('hudLauncher').classList.toggle('listening',on);
    roxy.armed = on;
    if(on)caption('Roxy','Listening…');
    else if(!roxy.pending && !roxy.speaking)$('hudRoxy').classList.remove('on');
  }
  function hear(text, final) {
    const wake = matchRoxyWake(text);
    let said = text;
    if (wake) { if(roxy.pending)cancelReply();setDockOpen(true); if (!roxy.armed) arm(true); said = text.slice(wake.index+wake[0].length); }
    if (!roxy.armed) return;
    said = said.trim();
    if(said)caption(final?'Heard':'Hearing',said);
    if (final && said) {
      if(roxy.pending)cancelReply();
      let kind;voiceCommand=true;
      try {kind=command(said);} finally {voiceCommand=false;}
      const parsed=parseCommand(said,landmarks);
      if(kind==='layer')say(overlayTarget===1 ? 'Showing '+(overlayLayers[parsed.layer]?.name || parsed.layer)+'.' : 'Overlay hidden.');
      if(kind==='menu')caption('Roxy',parsed.menu==='layers'?'Overlays open':parsed.menu+' open');
      // Keep listening for follow-up instructions until explicitly closed.
      if(kind==='close'){arm(false);setDockOpen(false);}
    }
  }
  function startRecogniser() {
    if (!Recognition || roxy.running || !roxy.enabled || roxy.speaking) return;
    const r = roxy.recogniser = Object.assign(new Recognition(), {lang:'en-US', interimResults:true, continuous:true, maxAlternatives:5});
    const handled=new Set();
    r.onstart=()=>{if(r!==roxy.recogniser)return;roxy.status='Listening · say “Roxy”';refreshRoxy();};
    r.onresult = event => {
      if(r!==roxy.recogniser || !roxy.enabled || roxy.speaking)return;
      roxy.networkFailures=0;
      for (let i=event.resultIndex; i<event.results.length; i++) {
        const result = event.results[i];
        if(handled.has(i))continue;
        if(result.isFinal)handled.add(i);
        const text=selectVoiceTranscript(Array.from(result,alternative=>alternative.transcript),roxy.armed,landmarks);
        hear(text, result.isFinal);
        if(roxy.speaking)break;
      }
    };
    r.onerror = event => {
      if(r!==roxy.recogniser)return;
      if(event.error==='network' && ++roxy.networkFailures<=3) {
        stopRecogniser();roxy.status='Reconnecting voice…';refreshRoxy();
        clearTimeout(roxy.restart);roxy.restart=setTimeout(startRecogniser,500*2**(roxy.networkFailures-1));return;
      }
      const errors={
        'not-allowed':'Mic blocked · allow microphone for this site, then retry',
        'service-not-allowed':'Voice service unavailable · try Chrome or Edge',
        'network':'Voice network error · check connection, then retry',
        'audio-capture':'No microphone · connect a mic, then retry',
        'language-not-supported':'Voice language unavailable · try Chrome or Edge'
      };
      if(errors[event.error]){roxy.enabled=false;roxy.status=errors[event.error];stopRecogniser();note(roxy.status+'. Press T to type commands.');refreshRoxy();}
    };
    r.onend = () => { if(r!==roxy.recogniser)return;roxy.running = false; if (roxy.enabled && !roxy.speaking) {clearTimeout(roxy.restart);roxy.restart=setTimeout(startRecogniser,150);} };
    try { roxy.running=true;r.start(); } catch { roxy.running=false;roxy.enabled=false;roxy.status='Voice could not start · click to retry';refreshRoxy(); }
  }
  function refreshRoxy() {
    const ear=$('hudEar');ear.classList.toggle('on',roxy.enabled);ear.setAttribute('aria-pressed',String(roxy.enabled));
    ear.textContent=Recognition ? roxy.status || 'Enable Roxy · V' : 'Voice unavailable · use Chrome/Edge or T';
    ear.title=roxy.enabled ? 'Turn off Roxy microphone' : 'Enable voice recognition (may use an online speech service)';
    if (!roxy.enabled) arm(false); buildMenus();
  }
  function setRoxy(on) {
    clearTimeout(roxy.restart);
    roxy.enabled = on && !!Recognition;
    roxy.networkFailures=0;
    roxy.status=roxy.enabled ? 'Starting microphone…' : '';
    if (roxy.enabled) startRecogniser(); else {stopRecogniser();cancelReply();}
    refreshRoxy();
  }
  $('hudEar').onclick=()=>setRoxy(!roxy.enabled);
  function resetAll() { resetButton?.click(); refill(); closeMenus(); note('Position reset'); }
  $('hudReset').onclick = resetAll;
  addEventListener('keydown', event => {
    if (event.target===input) return;
    if (event.code==='KeyV') { if (!event.repeat) { cancelReply();if (!roxy.enabled) setRoxy(true); if(roxy.enabled)arm(true); } return; }
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
    if (state.layer && state.layer!=='minerals' && overlayFade>0.02) {
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

  // Pressurized suit outline: integrated helmet, padded shoulders, gloves and boots.
  const figure = new Path2D('M-7-29 Q-13-33-11-42 Q-9-49 0-49 Q9-49 11-42 Q13-33 7-29 L13-26 L17-17 L23-14 L28-4 L35 4 Q39 10 34 13 L28 9 L23 5 L14-1 L12 14 L16 22 L13 25 L13 44 Q9 48 4 45 L3 24 L-3 24 L-4 45 Q-9 48-13 44 L-13 25 L-16 22 L-12 14 L-14-1 L-23 5 L-28 9 L-34 13 Q-39 10-35 4 L-28-4 L-23-14 L-17-17 L-13-26Z');
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
    arc(170, 280, state.o2, low(state.o2) ? RED : '#bdf5f1');  // oxygen, upper left
    arc(-35, 75, state.power, low(state.power) ? RED : '#e8efc9'); // suit power, right
    g.textAlign = 'center'; g.fillStyle = INK;
    $('evaO2').textContent=Math.round(state.o2*100)+'%';
    $('evaPower').textContent=Math.round(state.power*100)+'%';
    $('evaO2').style.color=low(state.o2) ? RED : '#bdf5f1';
    $('evaPower').style.color=low(state.power) ? RED : '#e8efc9';
    const strain = state.heart>150 || low(state.o2) ? RED : state.heart>125 ? AMBER : '#d8fff8';
    g.save(); g.translate(cx, cy-4); g.scale(1.15,1.15);
    g.fillStyle = strain; g.globalAlpha = 0.07; g.fill(figure);
    g.globalAlpha = 1; g.strokeStyle = strain; g.lineWidth = 1.5; g.lineJoin='round';g.stroke(figure);
    g.globalAlpha=.65;g.lineWidth=.8;
    g.beginPath();g.roundRect(-8,-43,16,10,4);g.stroke();
    g.beginPath();g.roundRect(-5,-18,10,9,2);g.stroke();
    g.beginPath();g.moveTo(-12,15);g.lineTo(12,15);g.moveTo(-12,38);g.lineTo(-4,38);g.moveTo(4,38);g.lineTo(12,38);g.stroke();g.restore();
    g.fillStyle = INK; g.font = '600 12px Bahnschrift,"Segoe UI",sans-serif';
    $('evaHeart').textContent=Math.round(state.heart)+' bpm';
    $('evaTemp').textContent=state.temp.toFixed(1)+' °C';
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
      uniforms.overlayOpacity.value = overlayFade*overlayStrength; redraw = true;
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

  replanAll(); setRoxy(true);
  function setWeather(value) {
    weatherHazards=value;
    overlayDirty=true;redraw=true;
    if(state.layer==='traffic' && overlayTarget===1) setLayer('traffic',true);
  }
  return {update, command, state, nav, landmarks, enterMap, exitMap, setLayer, camera, refill, hear, roxy,setWeather,setDockOpen,
    get activeLayer(){return overlayTarget===1 ? state.layer : null;},
    get flying() { return !!flight; }};
}
