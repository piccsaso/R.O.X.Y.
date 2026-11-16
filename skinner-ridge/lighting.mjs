// This code was generated through the use of SI.
import * as THREE from 'three';
export const lighting={sunDirection:{value:new THREE.Vector3()},ambientTint:{value:new THREE.Color()},
 sunTint:{value:new THREE.Color()},lampPosition:{value:new THREE.Vector3()},lampDirection:{value:new THREE.Vector3()},lampPower:{value:0}};
export const lightDeclarations=`
 uniform vec3 sunDirection,ambientTint,sunTint,lampPosition,lampDirection;
 uniform float lampPower;
 varying vec3 surfacePosition,surfaceNormal;
 vec3 surfaceLight(){
  vec3 toPoint=surfacePosition-lampPosition;
  float distanceSquared=dot(toPoint,toPoint);
  float beam=smoothstep(0.80,0.94,dot(normalize(toPoint),lampDirection));
  float incidence=max(0.15,dot(normalize(surfaceNormal),-normalize(toPoint)));
  vec3 lamp=vec3(1.0,0.91,0.77)*lampPower*beam*incidence/(1.0+distanceSquared*0.085);
  return ambientTint+sunTint*(0.35+0.65*max(0.0,dot(normalize(surfaceNormal),sunDirection)))+lamp;
 }`;
export function lightTerrain(material) {
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,lighting);
  shader.vertexShader='varying vec3 surfacePosition,surfaceNormal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsurfacePosition=position;surfaceNormal=normal;');
  shader.fragmentShader=lightDeclarations+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=surfaceLight();');
 };
 material.customProgramCacheKey=()=> 'mars-light-v1';
}
