import * as THREE from 'three';

const dust=new THREE.Color('#c1a18c');
const skyTint=new THREE.Color('#947971');

export function addLandscape(scene, camera, terrain, ground, meta) {
  const [width, depth]=meta.boundsMeters;
  const material=terrain.getObjectByProperty('isMesh',true).material;
  const atlas=material.map;
  scene.fog=new THREE.Fog(dust,24,106);

  const sky=new THREE.Mesh(new THREE.SphereGeometry(175,40,20),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,
    uniforms:{dust:{value:dust},tint:{value:skyTint}},
    vertexShader:`
      varying vec3 direction;
      void main() {
        direction=position;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }`,
    fragmentShader:`
      uniform vec3 dust;
      uniform vec3 tint;
      varying vec3 direction;
      void main() {
        vec3 ray=normalize(direction);
        float elevation=smoothstep(-0.03,0.76,ray.y);
        float glow=pow(max(0.0,dot(ray,normalize(vec3(-0.4,0.35,-0.8)))),10.0);
        gl_FragColor=vec4(mix(dust,tint,elevation)+vec3(0.1,0.064,0.038)*glow,1.0);
        #include <colorspace_fragment>
      }`
  }));
  sky.renderOrder=-1;
  sky.frustumCulled=false;
  sky.position.copy(camera.position);
  scene.add(sky);

  const border=[];
  for(let x=0;x<meta.width-1;x++) border.push([x*meta.step,0]);
  for(let z=0;z<meta.depth-1;z++) border.push([width,z*meta.step]);
  for(let x=meta.width-1;x>0;x--) border.push([x*meta.step,depth]);
  for(let z=meta.depth-1;z>0;z--) border.push([0,z*meta.step]);
  const rings=[0,0.12,0.35,0.7,1.3,2.3,3.8,6,9,14,21,31,44,62,84,110];
  const length=border.length;
  const positions=new Float32Array(length*rings.length*3);
  const radius=new Float32Array(length*rings.length);
  const indices=new Uint32Array(length*(rings.length-1)*6);
  const groundAt=(x,z)=>ground.sample(Math.max(0,Math.min(width-0.00001,x)),Math.max(0,Math.min(depth-0.00001,z))).height;
  const meanHeight=border.reduce((sum,[x,z])=>sum+groundAt(x,z),0)/length;
  for (let j=0;j<length;j++) {
    const [x,z]=border[j];
    const edge=groundAt(x,z);
    const xRay=2*x/width-1, zRay=2*z/depth-1;
    const inside=groundAt(x-0.18*xRay,z-0.18*zRay);
    const gradient=THREE.MathUtils.clamp((edge-inside)/0.18,-0.32,0.32);
    for (const [ring,r] of rings.entries()) {
      const xx=x+xRay*r, zz=z+zRay*r;
      const hills=0.95*Math.sin(xx*0.16+zz*0.11)+1.8*Math.cos(zz*0.066-xx*0.105)+
        0.24*Math.sin(xx*0.71+zz*0.44)+0.10*Math.cos(xx*2.4-zz*1.6);
      const fade=THREE.MathUtils.smoothstep(r,0,16);
      const height=THREE.MathUtils.lerp(edge,meanHeight+hills,fade)+gradient*r*Math.exp(-r*0.4);
      positions.set([xx,height,zz],(ring*length+j)*3);
      radius[ring*length+j]=r;
      if (!ring) continue;
      const a=(ring-1)*length+j, b=(ring-1)*length+(j+1)%length;
      const c=a+length, d=b+length;
      indices.set([a,b,c,b,d,c],(a)*6);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('radius',new THREE.BufferAttribute(radius,1));
  geometry.setIndex(new THREE.BufferAttribute(indices,1));
  const apron=new THREE.Mesh(geometry,new THREE.ShaderMaterial({
    side:THREE.DoubleSide,
    uniforms:{atlas:{value:atlas},extent:{value:new THREE.Vector2(width,depth)},dust:{value:dust}},
    vertexShader:`
      attribute float radius;
      varying vec2 worldXZ;
      varying float distanceToTerrain;
      varying float depthInView;
      void main() {
        worldXZ=position.xz;
        distanceToTerrain=radius;
        vec4 view=modelViewMatrix*vec4(position,1.0);
        depthInView=-view.z;
        gl_Position=projectionMatrix*view;
      }`,
    fragmentShader:`
      uniform sampler2D atlas;
      uniform vec2 extent;
      uniform vec3 dust;
      varying vec2 worldXZ;
      varying float distanceToTerrain;
      varying float depthInView;
      void main() {
        float r=distanceToTerrain;
        // Reflect a short strip of terrain color across the border so the
        // footprint ends without stretching a single row of texels.
        vec2 edgeXZ=extent-abs(extent-abs(worldXZ));
        vec3 edge=texture2D(atlas,clamp(edgeXZ/extent,0.0,1.0)).rgb;
        vec2 sampleOrigin=vec2(6.2,5.0);
        vec2 t0=abs(fract(worldXZ*0.39)*2.0-1.0);
        vec2 t1=abs(fract(mat2(0.6,-0.8,0.8,0.6)*worldXZ*0.71)*2.0-1.0);
        vec3 detail=mix(texture2D(atlas,(sampleOrigin+t0*1.2)/extent).rgb,
          texture2D(atlas,(sampleOrigin+t1*1.2)/extent).rgb,0.5);
        vec3 soil=mix(vec3(0.33,0.24,0.18),detail,0.6);
        float hills=sin(worldXZ.x*0.31+worldXZ.y*0.23)*0.018;
        vec3 color=mix(edge,soil+hills,smoothstep(0.35,3.0,r));
        gl_FragColor=vec4(mix(color,dust,smoothstep(24.0,106.0,depthInView)),1.0);
        #include <colorspace_fragment>
      }`
  }));
  scene.add(apron);
  return sky;
}
