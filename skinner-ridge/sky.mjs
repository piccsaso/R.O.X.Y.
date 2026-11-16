// This code was assisted through the use of SI.
import * as THREE from 'three';
import {lighting} from './lighting.mjs';

export async function createSky(scene,camera,data,renderer) {
 const stars=await new THREE.TextureLoader().loadAsync('stars.png');
 // EXRLoader's output is bottom-up; the PNG preserves that row order.
 stars.flipY=false;stars.colorSpace=THREE.SRGBColorSpace;stars.wrapS=THREE.RepeatWrapping;
 // Reproject once to a cubemap to avoid the equirectangular derivative
 // singularity smearing stars into radial streaks around the celestial poles.
 const starCube=new THREE.WebGLCubeRenderTarget(1024).fromEquirectangularTexture(renderer,stars);
 stars.dispose();
 const uniforms={stars:{value:starCube.texture},localToICRF:{value:new THREE.Matrix3()},sun:{value:new THREE.Vector3()},
  solarRadius:{value:0.003},daylight:{value:1},night:{value:0},horizon:{value:new THREE.Color()}};
 const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms,
 vertexShader:`varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
 fragmentShader:`
 uniform samplerCube stars;uniform mat3 localToICRF;uniform vec3 sun,horizon;
 uniform float solarRadius,daylight,night;varying vec3 direction;
 void main(){
  vec3 ray=normalize(direction);float altitude=max(0.0,ray.y);
  float sunDot=clamp(dot(ray,sun),-1.0,1.0),angle=acos(sunDot);
  float twilight=1.0-smoothstep(0.02,0.32,abs(sun.y));
  vec3 zenith=mix(vec3(0.0010,0.0015,0.0028),vec3(0.24,0.135,0.085),daylight);
  vec3 color=mix(horizon,zenith,pow(altitude,0.42));
  // Forward-scattered blue near the low Sun; warm dust away from it.
  float blueHalo=exp(-angle*angle/0.032)*twilight*smoothstep(-0.13,0.02,sun.y);
  color=mix(color,vec3(0.24,0.39,0.52),blueHalo*0.82);
  float aureole=exp(-angle*angle/0.0035)*smoothstep(-0.025,0.06,sun.y);
  color+=vec3(0.55,0.42,0.27)*aureole*0.34;
  float disk=1.0-smoothstep(solarRadius*0.85,solarRadius*1.15,angle);
  color+=vec3(1.0,0.91,0.76)*disk*4.0*smoothstep(-0.006,0.003,ray.y);
  vec3 eq=normalize(localToICRF*ray);
  vec3 catalogue=textureCube(stars,vec3(eq.x,eq.z,-eq.y)).rgb;
  float extinction=smoothstep(0.0,0.18,ray.y)*exp(-0.065/max(0.06,ray.y));
  color+=catalogue*night*extinction*0.7;
  gl_FragColor=vec4(color,1.0);
  #include <colorspace_fragment>
 }`});
 const dome=new THREE.Mesh(new THREE.SphereGeometry(190,48,24),material);
 dome.frustumCulled=false;dome.renderOrder=-10;scene.add(dome);
 const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
 let fraction=0,playing=true,lamp=false,last=0,frameTime=performance.now();
 function advanceClock(){
  const now=performance.now();
  if(playing)fraction=(fraction+(now-frameTime)/480000)%1;
  frameTime=now;
 }
 function setFraction(value){fraction=((value%1)+1)%1;frameTime=performance.now();}
 function update(){
  advanceClock();
  const t=fraction*(data.samples.length-1),index=Math.floor(t),f=t-index;
  const a=data.samples[index],b=data.samples[Math.min(index+1,data.samples.length-1)];
  const matrix=a.icrfToLocal.map((v,i)=>v*(1-f)+b.icrfToLocal[i]*f);
  uniforms.localToICRF.value.set(...matrix).transpose();
  uniforms.sun.value.fromArray(a.sun).lerp(new THREE.Vector3().fromArray(b.sun),f).normalize();
  uniforms.solarRadius.value=THREE.MathUtils.lerp(a.sunAngularRadius,b.sunAngularRadius,f);
  const sy=uniforms.sun.value.y,day=smooth(-0.16,0.22,sy),night=1-smooth(-0.27,-0.09,sy);
  uniforms.daylight.value=day;uniforms.night.value=night;
  const horizon=uniforms.horizon.value;
  horizon.setRGB(0.0035,0.0031,0.0045).lerp(new THREE.Color().setRGB(0.48,0.285,0.17),day);
  scene.fog.color.copy(horizon);scene.background=horizon;
  lighting.sunDirection.value.copy(uniforms.sun.value);
  lighting.ambientTint.value.setRGB(0.0025+day*0.59,0.0028+day*0.56,0.004+day*0.52);
  const direct=smooth(-0.02,0.30,sy)*0.58;
  lighting.sunTint.value.setRGB(direct,direct*0.94,direct*0.84);
  lighting.lampPosition.value.copy(camera.position);camera.getWorldDirection(lighting.lampDirection.value);
  lighting.lampPower.value=lamp?4.0:0;
  dome.position.copy(camera.position);
  last=index;
  return {fraction,playing,lamp,frameTime,utc:a.utc,sunElevation:Math.asin(sy)*180/Math.PI,sun:uniforms.sun.value.toArray()};
 }
 return {update,setFraction,togglePause(){advanceClock();playing=!playing;},setPlaying(v){advanceClock();playing=v;},toggleLamp(){lamp=!lamp;},
  get fraction(){return fraction;},get playing(){return playing;},get lamp(){return lamp;},
  setPreset(name){const target=name==='day'?0.4:name==='sunset'?0.015:-0.8;
   let best=0,error=Infinity;for(let i=0;i<data.samples.length;i++){const s=data.samples[i].sun;let e=Math.abs(s[1]-target);
    if(name==='sunset' && s[0]<0)e+=2;if(e<error){error=e;best=i;}}
   setFraction(best/(data.samples.length-1));playing=false;}
 };
}
