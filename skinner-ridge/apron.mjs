// The rendered context and its collision use exactly these same triangles.
export function buildApron(ground,meta) {
 const [width,depth]=meta.boundsMeters,step=meta.step;
 const border=[];
 for(let x=0;x<meta.width-1;x++)border.push([x*step,0]);
 for(let z=0;z<meta.depth-1;z++)border.push([width,z*step]);
 for(let x=meta.width-1;x>0;x--)border.push([x*step,depth]);
 for(let z=meta.depth-1;z>0;z--)border.push([0,z*step]);
 const rings=[0,0.12,0.35,0.7,1.3,2.3,3.8,6,9,14,21,31,44,62,84,110];
 const length=border.length,positions=new Float32Array(length*rings.length*3);
 const radius=new Float32Array(length*rings.length),indices=new Uint32Array(length*(rings.length-1)*6);
 const at=(x,z)=>ground.sample(Math.max(0,Math.min(width-1e-5,x)),Math.max(0,Math.min(depth-1e-5,z))).height;
 const mean=border.reduce((sum,[x,z])=>sum+at(x,z),0)/length;
 const edgeHeights=border.map(([x,z])=>at(x,z));
 const prefix=new Float64Array(length*3+1);
 for(let i=0;i<length*3;i++)prefix[i+1]=prefix[i]+edgeHeights[i%length];
 for(let j=0;j<length;j++) {
  const [x,z]=border[j],edge=at(x,z),xr=2*x/width-1,zr=2*z/depth-1;
  const gradient=Math.max(-0.32,Math.min(0.32,(edge-at(x-0.18*xr,z-0.18*zr))/0.18));
  for(let k=0;k<rings.length;k++) {
   const r=rings[k],xx=x+xr*r,zz=z+zr*r,t=Math.min(1,r/16),fade=t*t*(3-2*t);
   const hills=0.95*Math.sin(xx*0.16+zz*0.11)+1.8*Math.cos(zz*0.066-xx*0.105)+0.24*Math.sin(xx*0.71+zz*0.44)+0.10*Math.cos(xx*2.4-zz*1.6);
   const span=Math.min(180,Math.floor(r/step*0.7));
   const smoothEdge=(prefix[length+j+span+1]-prefix[length+j-span])/(2*span+1);
   positions.set([xx,smoothEdge*(1-fade)+(mean+hills)*fade+gradient*r*Math.exp(-r*1.5),zz],(k*length+j)*3);
   radius[k*length+j]=r;
   if(k){const a=(k-1)*length+j,b=(k-1)*length+(j+1)%length,c=a+length,d=b+length;indices.set([a,b,c,b,d,c],a*6);}
  }
 }
 function triangle(x,z,a,b,c) {
  a*=3;b*=3;c*=3;
  const ax=positions[a],az=positions[a+2],bx=positions[b]-ax,bz=positions[b+2]-az,cx=positions[c]-ax,cz=positions[c+2]-az;
  const det=bx*cz-bz*cx;if(Math.abs(det)<1e-12)return;
  const u=((x-ax)*cz-(z-az)*cx)/det,v=(bx*(z-az)-bz*(x-ax))/det;
  if(u< -0.0001 || v< -0.0001 || u+v>1.0001)return;
  return {height:positions[a+1]*(1-u-v)+positions[b+1]*u+positions[c+1]*v,slope:0,context:true};
 }
 function sample(x,z) {
  const r=Math.max(-x,x-width,-z,z-depth);if(r<0 || r>110)return;
  let k=0;while(k<rings.length-2 && rings[k+1]<r)k++;
  const xx=(x+r)/(1+2*r/width),zz=(z+r)/(1+2*r/depth);
  const cols=meta.width-1,rows=meta.depth-1;
  let j;
  if(Math.abs(r+z)<1e-6)j=Math.floor(xx/step);
  else if(Math.abs(r-x+width)<1e-6)j=cols+Math.floor(zz/step);
  else if(Math.abs(r-z+depth)<1e-6)j=cols+rows+Math.floor((width-xx)/step);
  else j=2*cols+rows+Math.floor((depth-zz)/step);
  for(let off=-2;off<=2;off++) {
   const n=((j+off)%length+length)%length,a=k*length+n,b=k*length+(n+1)%length,c=a+length,d=b+length;
   const hit=triangle(x,z,a,b,c)||triangle(x,z,b,d,c);if(hit)return hit;
  }
 }
 return {positions,radius,indices,sample,bounds:[-110,width+110,-110,depth+110]};
}
