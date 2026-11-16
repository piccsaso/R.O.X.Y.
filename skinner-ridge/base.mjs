// Home Base: a concept habitat placed beside the start position. It is an illustration of where a walk
// begins and ends, not a NASA design and not part of the measured terrain. Lights are animated.
import * as THREE from 'three';
import {lightTerrain} from './lighting.mjs';

export function addHomeBase(scene, ground, [x, z], facing=0) {
  const y = ground.sample(x,z)?.height ?? 0;
  // Static parts are baked into world coordinates so the terrain lighting (sun, sky, suit lamp) falls on them correctly.
  const place = new THREE.Matrix4().makeRotationY(facing).setPosition(x, y, z);
  // Lit like the terrain, plus a low warm fill, as if from the habitat's own floodlights, so it reads at night.
  const lit = colour => {
    const m = new THREE.MeshBasicMaterial({color:colour});
    lightTerrain(m);
    const terrainLight = m.onBeforeCompile;
    m.onBeforeCompile = (shader, renderer) => {
      terrainLight(shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace('diffuseColor.rgb*=surfaceLight();',
        'diffuseColor.rgb*=(surfaceLight()+vec3(0.20,0.165,0.13)*(0.55+0.45*max(0.0,normalize(surfaceNormal).y*0.5+0.5)));');
    };
    m.customProgramCacheKey = () => 'mars-light-base';
    return m;
  };
  const glow = (colour, opacity=1) => new THREE.MeshBasicMaterial({color:colour, fog:false, transparent:opacity<1, opacity, depthWrite:opacity===1});
  const group = new THREE.Group();
  const add = (geometry, material, px=0, py=0, pz=0, rx=0, ry=0, rz=0) => {
    geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx,ry,rz)).setPosition(px,py,pz));
    geometry.applyMatrix4(place);
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
    return mesh;
  };
  const hull = lit('#d9d4cb'), dark = lit('#3b3a3f'), panel = lit('#1d2a52'), foil = lit('#b8892f'), regolith = lit('#8a6a55');

  // Regolith berm and landing pad the habitat sits on.
  add(new THREE.CylinderGeometry(4.6, 5.4, 0.35, 40), regolith, 0, 0.1, 0);
  // Main habitat: upright cylinder with a dome, a window band and a base skirt.
  add(new THREE.CylinderGeometry(2.3, 2.3, 2.7, 40), hull, 0, 1.6, 0);
  add(new THREE.SphereGeometry(2.3, 40, 16, 0, Math.PI*2, 0, Math.PI/2), hull, 0, 2.95, 0);
  add(new THREE.CylinderGeometry(2.45, 2.6, 0.5, 40), dark, 0, 0.5, 0);
  add(new THREE.TorusGeometry(2.32, 0.07, 8, 48), dark, 0, 2.95, 0, Math.PI/2);
  const windows = add(new THREE.CylinderGeometry(2.33, 2.33, 0.42, 40, 1, true, -0.9, 1.8), glow('#ffd9a0'), 0, 2.0, 0);
  // Airlock facing the walk, with a lit hatch and a short ramp.
  add(new THREE.BoxGeometry(1.5, 2.0, 1.7), hull, 0, 1.25, 2.9);
  add(new THREE.BoxGeometry(1.7, 0.12, 1.9), dark, 0, 2.3, 2.9);
  add(new THREE.PlaneGeometry(0.95, 1.6), dark, 0, 1.15, 3.755);
  const hatch = add(new THREE.PlaneGeometry(0.46, 0.46), glow('#9fe6ff'), 0, 1.55, 3.765);
  add(new THREE.BoxGeometry(1.4, 0.08, 1.6), dark, 0, 0.3, 4.4, 0.2);
  // Side module: a horizontal cylinder joined by a tunnel, wrapped in gold foil at the ends.
  add(new THREE.CylinderGeometry(1.25, 1.25, 4.2, 28), hull, -4.6, 1.45, -0.3, 0, 0, Math.PI/2);
  add(new THREE.CylinderGeometry(1.27, 1.27, 0.5, 28), foil, -6.5, 1.45, -0.3, 0, 0, Math.PI/2);
  add(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 20), dark, -2.6, 1.3, -0.2, 0, 0, Math.PI/2);
  for (const sx of [-5.8, -3.4]) for (const sz of [-1.1, 0.5]) add(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), dark, sx, 0.3, sz);
  // Solar arrays on tilted frames.
  for (const sx of [4.4, 7.4]) {
    add(new THREE.BoxGeometry(2.7, 0.06, 1.7), panel, sx, 1.35, -1.6, -0.6);
    add(new THREE.BoxGeometry(2.8, 0.04, 0.06), hull, sx, 1.36, -1.6, -0.6);
    add(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), dark, sx, 0.65, -1.2);
  }
  // Communications mast with a dish and a beacon.
  add(new THREE.CylinderGeometry(0.06, 0.09, 5.2, 10), dark, 2.9, 2.9, -2.6);
  add(new THREE.SphereGeometry(0.75, 24, 12, 0, Math.PI*2, 0, 1.05), hull, 2.9, 4.1, -2.1, 1.9, 0.5, 0);
  // Antenna whip on the dome.
  add(new THREE.CylinderGeometry(0.02, 0.03, 1.6, 6), dark, 0.6, 5.3, 0.3);

  // Animated lights. These glow on their own, so they read at night.
  const beacon = add(new THREE.SphereGeometry(0.13, 12, 8), glow('#ff2a1c'), 2.9, 5.6, -2.6);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({color:'#ff3b2a', transparent:true, opacity:0.5, depthWrite:false, fog:false, blending:THREE.AdditiveBlending}));
  halo.position.set(2.9, 5.6, -2.6).applyMatrix4(place); halo.scale.setScalar(1.6); group.add(halo);
  const strobe = add(new THREE.SphereGeometry(0.07, 8, 6), glow('#ffffff'), 0.6, 6.12, 0.3);
  // Warm light spilling from the windows and hatch onto the ground.
  const pool = add(new THREE.CircleGeometry(6.5, 48), glow('#ffb774', 0.3), 0, 0.31, 2.2, -Math.PI/2);
  pool.material.blending = THREE.AdditiveBlending; pool.renderOrder = 1;
  // Path lights from the airlock toward the walk.
  const markers = [];
  for (let i=0; i<5; i++) for (const side of [-0.9, 0.9]) markers.push(add(new THREE.SphereGeometry(0.045, 8, 6), glow('#8dff6a'), side, 0.4, 5.6+i*1.5));

  scene.add(group);
  let t = 0;
  return {group, position:[x,z], top:y+5.6,
    update(dt) {
      t += dt;
      const blink = (t%1.6)<0.18;
      beacon.material.color.set(blink ? '#ff4a35' : '#3a0a06');
      halo.material.opacity = blink ? 0.75 : 0.04;
      strobe.visible = (t%2.4)<0.07;
      const breathe = 0.82+0.18*Math.sin(t*1.3);
      windows.material.color.setRGB(1.0*breathe, 0.85*breathe, 0.63*breathe);
      hatch.material.color.setRGB(0.5*breathe, 0.72*breathe, 0.8*breathe);
      pool.material.opacity = 0.2+0.1*breathe;
      // A running light chases along the path markers toward the trail.
      const lead = Math.floor(t*4)%5;
      markers.forEach((m, i) => m.material.color.set(Math.floor(i/2)===lead ? '#d7ffb8' : '#2f6b22'));
      return true;
    }};
}
