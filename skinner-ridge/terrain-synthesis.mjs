// This code was generated through the use of SI.
import {sampleDistance} from './infill.mjs';

// Deterministic example-based completion. Each donor contains both Navcam
// color and its stereo relief. Minimum-error cuts preserve whole grains and
// stone edges, unlike averaging four unrelated images at each texel.
export function quiltSurface(pixels,width,depth,scale,quality,mask,heights) {
  const iw=width*scale, ih=depth*scale, stride=width+1;
  const cells=40, size=cells*scale, overlap=10*scale, advance=size-overlap;
  const reliable=new Uint8Array(width*depth);
  for(let z=0;z<depth;z++) for(let x=0;x<width;x++) {
    const i=z*width+x, p=((z*scale+3)*iw+x*scale+3)*4;
    reliable[i]=Number(mask[i]===3 && quality[i]>0.38 && pixels[p+3]===255);
  }
  const interior=sampleDistance(reliable.map(v=>1-v),width);
  const donors=[];
  for(let z=cells;z<depth-cells;z+=9) for(let x=cells;x<width-cells;x+=9) {
    // Inspect the whole square: a Manhattan distance alone misses corners.
    if(interior[z*width+x]<cells/2) continue;
    const x0=x-cells/2,z0=z-cells/2;
    let good=true;
    for(let v=0;v<cells && good;v++) for(let u=0;u<cells;u++) {
      if(!reliable[(z0+v)*width+x0+u]) {good=false;break;}
    }
    if(!good) continue;
    const h=heights[z*stride+x];
    const dx=(heights[z*stride+x+cells/2]-heights[z*stride+x-cells/2])/cells;
    const dz=(heights[(z+cells/2)*stride+x]-heights[(z-cells/2)*stride+x])/cells;
    if(Math.hypot(dx,dz)/0.035>0.72) continue;
    let sum=0,sum2=0,n=0,low=255,high=0;
    for(let v=0;v<size;v+=7) for(let u=0;u<size;u+=7) {
      const p=((z0*scale+v)*iw+x0*scale+u)*4;
      const l=pixels[p+1]; sum+=l;sum2+=l*l;n++;low=Math.min(low,l);high=Math.max(high,l);
    }
    const mean=sum/n, deviation=Math.sqrt(sum2/n-mean*mean);
    if(mean<65 || mean>195 || deviation<2 || deviation>28 || high-low>125) continue;
    const rgb=new Uint8Array(size*size*3), relief=new Float32Array(cells*cells);
    const means=[0,0,0];
    for(let v=0;v<size;v++) for(let u=0;u<size;u++) {
      const from=((z0*scale+v)*iw+x0*scale+u)*4,to=(v*size+u)*3;
      for(let c=0;c<3;c++) {rgb[to+c]=pixels[from+c];means[c]+=pixels[from+c];}
    }
    let meanRelief=0;
    for(let v=0;v<cells;v++) for(let u=0;u<cells;u++) {
      const r=heights[(z0+v)*stride+x0+u]-h-dx*(u-cells/2)-dz*(v-cells/2);
      relief[v*cells+u]=r;meanRelief+=r;
    }
    meanRelief/=relief.length;
    for(let i=0;i<relief.length;i++) relief[i]=Math.max(-0.22,Math.min(0.28,relief[i]-meanRelief));
    donors.push({rgb,relief,mean:means.map(v=>v/(size*size)),sourceCell:[x,z]});
  }
  if(donors.length<4) throw new Error('Insufficient intact photo/relief donor patches: '+donors.length);
  console.log({jointSurfaceDonors:donors.length,patchMeters:cells*0.035});
  // Signed detail has its mean removed; local measured base colors supply tone.
  const texture=new Int8Array(iw*ih*3);
  const residual=new Float32Array(width*depth);
  let seed=671167;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const detail=(donor,u,v,c)=>Math.max(-95,Math.min(95,donor.rgb[(v*size+u)*3+c]-donor.mean[c]));
  for(let py=0;py<ih;py+=advance) {
    for(let px=0;px<iw;px+=advance) {
      const pw=Math.min(size,iw-px),ph=Math.min(size,ih-py);
      let donor=donors[Math.floor(random()*donors.length)],best=Infinity;
      for(let attempt=0;attempt<20;attempt++) {
        const candidate=donors[Math.floor(random()*donors.length)];
        let error=0,n=0;
        for(let v=0;v<ph;v+=11) for(let u=0;u<pw;u+=11) {
          if(!(px && u<overlap) && !(py && v<overlap)) continue;
          const old=texture[((py+v)*iw+px+u)*3+1];
          const delta=old-detail(candidate,u,v,1);
          error+=delta*delta;n++;
        }
        // A small random component prevents one low-contrast donor monopolizing fill.
        error=error/Math.max(1,n)+random()*12;
        if(error<best) {best=error;donor=candidate;}
      }
      const difference=(u,v)=>{
        const old=texture[((py+v)*iw+px+u)*3+1];
        return (old-detail(donor,u,v,1))**2;
      };
      const left=px ? minimumCut(Math.min(overlap,pw),ph,(u,v)=>difference(u,v)) : null;
      const top=py ? minimumCut(Math.min(overlap,ph),pw,(v,u)=>difference(u,v)) : null;
      for(let v=0;v<ph;v++) for(let u=0;u<pw;u++) {
        // Feather just three pixels along the cut, not the entire overlap.
        const a=left ? Math.max(0,Math.min(1,(u-left[v]+1.5)/3)) : 1;
        const b=top ? Math.max(0,Math.min(1,(v-top[u]+1.5)/3)) : 1;
        const weight=Math.min(a,b);
        if(!weight) continue;
        const at=((py+v)*iw+px+u)*3;
        for(let c=0;c<3;c++) texture[at+c]=Math.round(texture[at+c]*(1-weight)+detail(donor,u,v,c)*weight);
        if((px+u)%scale===3 && (py+v)%scale===3) {
          const ci=Math.floor((py+v)/scale)*width+Math.floor((px+u)/scale);
          const r=donor.relief[Math.floor(v/scale)*cells+Math.floor(u/scale)];
          residual[ci]=residual[ci]*(1-weight)+r*weight;
        }
      }
    }
  }
  // Preserve every measured triangle vertex. Blend predicted detail in over
  // 45 cm, then soften only quilting seams in the new relief field.
  const anchors=new Uint8Array(heights.length);
  for(let i=0;i<mask.length;i++) {
    const a=Math.floor(i/width)*stride+i%width;
    if(mask[i]&1) anchors[a]=anchors[a+1]=anchors[a+stride]=1;
    if(mask[i]&2) anchors[a+1]=anchors[a+stride]=anchors[a+stride+1]=1;
  }
  const distance=sampleDistance(anchors,stride);
  for(let pass=0;pass<2;pass++) {
    const copy=residual.slice();
    for(let z=1;z<depth-1;z++) for(let x=1;x<width-1;x++) {
      const i=z*width+x;
      residual[i]=copy[i]*0.6+(copy[i-1]+copy[i+1]+copy[i-width]+copy[i+width])*0.1;
    }
  }
  for(let z=0;z<=depth;z++) for(let x=0;x<=width;x++) {
    const i=z*stride+x,t=Math.min(1,distance[i]*0.035/0.45);
    heights[i]+=residual[Math.min(z,depth-1)*width+Math.min(x,width-1)]*t*t*(3-2*t);
  }
  return {texture,donorCount:donors.length,patchMeters:cells*0.035,
    donorCells:donors.map(d=>d.sourceCell)};
}

// Dynamic-programming seam through a rectangular overlap.
function minimumCut(width,height,error) {
  let previous=new Float64Array(width),current=new Float64Array(width);
  const parent=new Int16Array(width*height);
  for(let x=0;x<width;x++) previous[x]=error(x,0);
  for(let y=1;y<height;y++) {
    for(let x=0;x<width;x++) {
      let from=x;
      if(x && previous[x-1]<previous[from]) from=x-1;
      if(x+1<width && previous[x+1]<previous[from]) from=x+1;
      current[x]=error(x,y)+previous[from];parent[y*width+x]=from;
    }
    [previous,current]=[current,previous];
  }
  let x=0;
  for(let u=1;u<width;u++) if(previous[u]<previous[x]) x=u;
  const path=new Int16Array(height);
  for(let y=height-1;y>=0;y--) {path[y]=x;x=parent[y*width+x];}
  return path;
}
