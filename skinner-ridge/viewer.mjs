import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {makeGround} from './ground.mjs';
import {addLandscape} from './landscape.mjs';

const status = document.getElementById('status');
const enter = document.getElementById('enter');
const reset = document.getElementById('reset');
const keys = new Set();
const eyeHeight = 1.65;
const help = 'WASD to walk · Mouse to look · R to reset · Esc to exit';
let renderer;

async function get(url, method) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(url + ' returned ' + response.status);
  return response[method]();
}

// The export stays a single mesh. The viewer can skip tiles outside the camera.
function tileTerrain(terrain, {width,depth,step}) {
  const source=terrain.getObjectByProperty('isMesh',true);
  const original=source.geometry;
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
      new THREE.Vector3(x*step,floor,z*step),new THREE.Vector3(endX*step,ceiling,endZ*step)
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
  const [mesh, meta, binary, route] = await Promise.all([
    new GLTFLoader().loadAsync('terrain.glb'), get('terrain.json','json'),
    get('ground.bin','arrayBuffer'), get('route.json','json')
  ]);
  tileTerrain(mesh.scene,meta);
  scene.add(mesh.scene);
  const terrainMaterial=mesh.scene.getObjectByProperty('isMesh',true).material;
  terrainMaterial.map.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
  const ground = makeGround(meta,binary);
  const canvas = renderer.domElement;
  const query = new URLSearchParams(location.search);
  const mode = query.get('view');
  if (query.has('qa')) window.walkPose = () => ({position:camera.position.toArray(),yaw:camera.rotation.y,pitch:camera.rotation.x,locked:document.pointerLockElement===canvas});
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
  const sky=mode==='survey' ? null : addLandscape(scene,camera,mesh.scene,ground,meta);
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
    keys.add(event.code);
  });
  addEventListener('keyup',event => keys.delete(event.code));
  addEventListener('blur',() => keys.clear());
  let previous = performance.now();
  renderer.setAnimationLoop(now => {
    const dt = Math.min(0.10, (now-previous)*0.001);
    previous = now;
    const forward = Number(keys.has('KeyW'))-Number(keys.has('KeyS'));
    const strafe = Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
    if (lock() && (forward || strafe)) {
      const substeps = Math.max(1,Math.ceil(dt/0.025));
      const speed = dt * 1.1 / (Math.hypot(forward,strafe)*substeps);
      const dx = (strafe*Math.cos(yaw)-forward*Math.sin(yaw))*speed;
      const dz = (-strafe*Math.sin(yaw)-forward*Math.cos(yaw))*speed;
      // Resolve the axes separately so a diagonal move can slide along the boundary.
      for (let i=0;i<substeps;i++) for (const [ax,az] of [[dx,0],[0,dz]]) {
        const x = camera.position.x+ax, z = camera.position.z+az;
        const y = ground.foot(x,z);
        if (Number.isFinite(y) && Math.abs(y+eyeHeight-camera.position.y)<0.15) {
          camera.position.set(x,y+eyeHeight,z);
          needsFrame = true;
        }
      }
    }
    if (needsFrame) {
      sky?.position.copy(camera.position);
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
