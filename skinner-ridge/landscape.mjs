// This code was assisted through the use of SI.
import * as THREE from 'three';
import {buildApron} from './apron.mjs';
import {lighting,lightDeclarations} from './lighting.mjs';

export function addLandscape(scene,ground,meta,maps) {
 const apron=buildApron(ground,meta);
 scene.fog=new THREE.Fog(new THREE.Color('#b68c70'),35,150);
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(apron.positions,3));
 geometry.setAttribute('radius',new THREE.BufferAttribute(apron.radius,1));
 geometry.setIndex(new THREE.BufferAttribute(apron.indices,1));geometry.computeVertexNormals();
 const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,
 uniforms:{...lighting,atlas0:{value:maps[0]},atlas1:{value:maps[1]},atlas2:{value:maps[2]},atlas3:{value:maps[3]},
  extent:{value:new THREE.Vector2(...meta.boundsMeters)},dust:{value:scene.fog.color}},
 vertexShader:`attribute float radius;varying vec2 worldXZ;varying float distanceToTerrain,depthInView;
 varying vec3 surfacePosition,surfaceNormal;
 void main(){worldXZ=position.xz;distanceToTerrain=radius;surfacePosition=position;surfaceNormal=normal;
 vec4 view=modelViewMatrix*vec4(position,1.0);depthInView=-view.z;gl_Position=projectionMatrix*view;}`,
 fragmentShader:lightDeclarations+`
 uniform sampler2D atlas0,atlas1,atlas2,atlas3;uniform vec2 extent;uniform vec3 dust;
 varying vec2 worldXZ;varying float distanceToTerrain,depthInView;
 vec3 atlas(vec2 uv){uv=clamp(uv,0.00001,0.99999);vec2 p=fract(uv*2.0);
 if(uv.y<0.5){if(uv.x<0.5)return texture2D(atlas0,p).rgb;return texture2D(atlas1,p).rgb;}
 if(uv.x<0.5)return texture2D(atlas2,p).rgb;return texture2D(atlas3,p).rgb;}
 void main(){float r=distanceToTerrain;vec2 edgeXZ=extent-abs(extent-abs(worldXZ));
 vec3 edge=atlas(edgeXZ/extent);vec2 t0=abs(fract(worldXZ*0.39)*2.0-1.0);
 vec2 t1=abs(fract(mat2(0.6,-0.8,0.8,0.6)*worldXZ*0.71)*2.0-1.0);
 vec3 detail=mix(atlas((vec2(6.2,5.0)+t0*1.2)/extent),atlas((vec2(6.2,5.0)+t1*1.2)/extent),0.5);
 vec3 soil=mix(vec3(0.30,0.21,0.15),detail,0.75);
 vec3 color=mix(edge,soil,smoothstep(0.35,3.0,r))*surfaceLight();
 gl_FragColor=vec4(mix(color,dust,smoothstep(35.0,150.0,depthInView)),1.0);
 #include <colorspace_fragment>
 }`});
 scene.add(new THREE.Mesh(geometry,material));
 return apron;
}
