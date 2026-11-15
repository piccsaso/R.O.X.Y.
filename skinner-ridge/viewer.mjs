import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {makeGround} from './ground.mjs';
import {addLandscape} from './landscape.mjs';
import {createSky} from './sky.mjs';
import {lightTerrain} from './lighting.mjs';

const status = document.getElementById('status');
const enter = document.getElementById('enter');
const reset = document.getElementById('reset');
const keys = new Set();
const eyeHeight = 1.65;
const help = 'WASD walk · Shift sprint · F light · Mouse look · R reset · Esc release';
let renderer;

async function get(url, method) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(url + ' returned ' + response.status);
  return response[method]();
}

// The export stays a single mesh. The viewer can skip tiles outside the camera.
function tileTerrain(terrain, {width,depth,step,x0=0,z0=0}) {
  const source=terrain.getObjectByProperty('isMesh',true);
  const original=source.geometry;
  if(!original.getAttribute('normal'))original.computeVertexNormals();
  const positions=original.getAttribute('position');
  const indices=original.getIndex().array;
  const tileSize=80;
  const tiles=new THREE.Group();
  for (let z=0;z<depth-1;z+=tileSize) for (let x=0;x<width-1;x+=tileSize) {
    const endX=Math.min(width-1,x+tileSize), endZ=Math.min(depth-1,z+tileSize);
    const tileIndices=new Uint32Array((endX-x)*(endZ-z)*6);
    let floor=Infinity, ceiling=-Infinity;
    for (let row=z;row<=endZ;row++) {
      for (let col=x;col<=endX;col++) {
        const y=positions.getY(row*width+col);
        floor=Math.min(floor,y);
        ceiling=Math.max(ceiling,y);
      }
      if (row===endZ) continue;
      const first=(row*(width-1)+x)*6;
      tileIndices.set(indices.subarray(first,first+(endX-x)*6),(row-z)*(endX-x)*6);
    }
    const geometry=new THREE.BufferGeometry();
    for (const [name,attribute] of Object.entries(original.attributes)) geometry.setAttribute(name,attribute);
    geometry.setIndex(new THREE.BufferAttribute(tileIndices,1));
    geometry.boundingBox=new THREE.Box3(
      new THREE.Vector3((x+x0)*step,floor,(z+z0)*step),new THREE.Vector3((endX+x0)*step,ceiling,(endZ+z0)*step)
    );
    geometry.boundingSphere=geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
    tiles.add(new THREE.Mesh(geometry,source.material));
  }
  tiles.position.copy(source.position);
  tiles.quaternion.copy(source.quaternion);
  tiles.scale.copy(source.scale);
  source.parent.add(tiles);
  source.removeFromParent();
}

try {
  renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  document.body.prepend(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(62,1,0.04,220);
  camera.rotation.order = 'YXZ';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#a98978');
  const [meta,binary,route,skyData]=await Promise.all([get('terrain.json','json'),get('ground.bin','arrayBuffer'),get('route.json','json'),get('sky-data.json','json')]);
  const meshes=await Promise.all(meta.tiles.map(tile=>new GLTFLoader().loadAsync(tile.file)));
  const maps=meshes.map((mesh,i)=>{
    const material=mesh.scene.getObjectByProperty('isMesh',true).material;
    lightTerrain(material);material.map.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
    tileTerrain(mesh.scene,meta.tiles[i]);scene.add(mesh.scene);return material.map;
  });
  const coreGround=makeGround(meta,binary);
  const apron=addLandscape(scene,coreGround,meta,maps);
  const ground={sample:(x,z)=>coreGround.sample(x,z)||apron.sample(x,z)};
  ground.foot=(x,z)=>ground.sample(x,z)?.height;
  const canvas = renderer.domElement;
  const query = new URLSearchParams(location.search);
  const mode = query.get('view');
  let movingTime=0;
  if (query.has('qa')) window.walkPose = () => ({position:camera.position.toArray(),yaw:camera.rotation.y,pitch:camera.rotation.x,movingTime,locked:document.pointerLockElement===canvas});
  const lock = () => document.pointerLockElement === canvas;
  let yaw = 0, pitch = 0;
  let needsFrame = true;
  function pose({x,z,targetX,targetZ}) {
    const y = ground.foot(x,z);
    if (!Number.isFinite(y)) throw new Error('Route viewpoint is outside walkable ground');
    camera.position.set(x,y+eyeHeight,z);
    yaw = Math.atan2(x-targetX,z-targetZ);
    const targetY = ground.sample(targetX,targetZ)?.height ?? y;
    pitch = Math.atan2(targetY-y-eyeHeight,Math.hypot(x-targetX,z-targetZ));
    camera.rotation.set(pitch,yaw,0);
    needsFrame = true;
  }
  const lower={x:14+meta.origin[1]-2.51,z:22+77.49-meta.origin[0],
    targetX:14.6+meta.origin[1]-2.51,targetZ:17+77.49-meta.origin[0]};
  pose(mode==='lower-path' ? route.lowerPath.start : mode==='lower-extension' ? route.lowerPath.end :
    mode==='lower' ? lower : mode==='expanded' ? route.expansion.end : mode==='return' ? route.return : route.spawn);
  const sky=await createSky(scene,camera,skyData,renderer);
  const preset=query.get('sky');
  if(preset)sky.setPreset(preset);
  if(query.has('qa')) {
    sky.setPlaying(false);
    window.skyState=()=>sky.update(0);
    window.qaSky=name=>{sky.setPreset(name);needsFrame=true;};
    window.qaLamp=()=>{sky.toggleLamp();needsFrame=true;};
    window.qaAim=(a,b)=>{yaw=a;pitch=b;camera.rotation.set(pitch,yaw,0);needsFrame=true;};
    window.qaPosition=(x,z)=>{const y=ground.foot(x,z);if(!Number.isFinite(y))throw new Error('Outside surface');camera.position.set(x,y+eyeHeight,z);needsFrame=true;};
  }
  const pause=document.getElementById('pause-sky'),slider=document.getElementById('time-of-day'),clock=document.getElementById('sky-clock'),lamp=document.getElementById('lamp');
  pause.onclick=()=>{sky.togglePause();needsFrame=true;};
  slider.oninput=()=>{sky.setFraction(Number(slider.value)/1000);sky.setPlaying(false);needsFrame=true;};
  lamp.onclick=()=>{sky.toggleLamp();needsFrame=true;};
  if (mode==='survey') {
    camera.position.set(meta.boundsMeters[0]/2,Math.max(...meta.boundsMeters)*1.2,meta.boundsMeters[1]/2);
    camera.rotation.set(-Math.PI/2,0,0);
  }
  function resize() {
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
    needsFrame = true;
  }
  addEventListener('resize',resize);
  resize();
  enter.onclick = async () => {
    try { await canvas.requestPointerLock(); }
    catch { status.textContent = 'Mouse capture unavailable. Open the demo in a desktop browser.'; }
  };
  reset.onclick = () => pose(route.spawn);
  document.addEventListener('pointerlockchange',() => {
    document.body.classList.toggle('locked',lock());
    keys.clear();
    status.textContent = lock() ? help : 'Click Enter terrain to walk';
  });
  document.addEventListener('mousemove',event => {
    if (!lock()) return;
    yaw -= event.movementX*0.002;
    pitch = THREE.MathUtils.clamp(pitch-event.movementY*0.002,-1.52,1.52);
    camera.rotation.set(pitch,yaw,0);
    needsFrame = true;
  });
  addEventListener('keydown',event => {
    if (!lock()) return;
    if (event.code==='KeyR') pose(route.spawn);
    if (event.code==='KeyF' && !event.repeat){sky.toggleLamp();needsFrame=true;}
    keys.add(event.code);
  });
  addEventListener('keyup',event => keys.delete(event.code));
  addEventListener('blur',() => keys.clear());
  let previous = performance.now();
  renderer.setAnimationLoop(now => {
    // Substeps keep collision stable while allowing slower renderers to keep
    // up with wall time. Clamp only long stalls (e.g. a backgrounded tab).
    const elapsed=Math.max(0,(now-previous)*0.001);
    const dt = Math.min(0.50,elapsed);
    previous = now;
    const forward = Number(keys.has('KeyW'))-Number(keys.has('KeyS'));
    const strafe = Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
    if (lock() && (forward || strafe)) {
      movingTime+=dt;
      const substeps = Math.max(1,Math.ceil(dt/0.025));
      const speed = dt * (keys.has('ShiftLeft')||keys.has('ShiftRight')?5.0:2.6) / (Math.hypot(forward,strafe)*substeps);
      const dx = (strafe*Math.cos(yaw)-forward*Math.sin(yaw))*speed;
      const dz = (-strafe*Math.sin(yaw)-forward*Math.cos(yaw))*speed;
      // Resolve the axes separately so a diagonal move can slide along the boundary.
      for (let i=0;i<substeps;i++) for (const [ax,az] of [[dx,0],[0,dz]]) {
        const x = camera.position.x+ax, z = camera.position.z+az;
        const y = ground.foot(x,z);
        if (Number.isFinite(y)) {
          camera.position.set(x,y+eyeHeight,z);
          needsFrame = true;
        }
      }
    }
    if (needsFrame || sky.playing) {
      const state=sky.update(elapsed);
      slider.value=String(Math.round(state.fraction*1000));
      pause.textContent=state.playing?'Pause sky':'Resume sky';
      lamp.textContent=state.lamp?'Light on':'Light off';
      lamp.setAttribute('aria-pressed',String(state.lamp));
      clock.textContent=(state.sunElevation>0?'Day':state.sunElevation> -12?'Twilight':'Night')+' · Sol 477 replay · '+state.utc.slice(11,16)+' UTC';
      renderer.render(scene,camera);
      needsFrame = false;
    }
  });
  enter.disabled = false;
  reset.disabled = false;
  status.textContent = 'Click Enter terrain to walk';
} catch (error) {
  status.textContent = 'Could not open the terrain. ' + error.message;
  console.error(error);
  renderer?.dispose();
}
