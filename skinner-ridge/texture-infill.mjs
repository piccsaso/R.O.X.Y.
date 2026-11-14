import {completeField, sampleDistance} from './infill.mjs';

export function completeTexture(pixels, width, depth, scale, measuredFaces, quality, heights) {
  const imageWidth=width*scale, imageDepth=depth*scale;
  const colors=Array.from({length:3},()=>new Float32Array(width*depth).fill(NaN));
  const valid=new Uint8Array(measuredFaces.length);
  let measuredPixels=0;

  for (let row=0;row<depth;row++) for (let col=0;col<width;col++) {
    const cell=row*width+col;
    if (!measuredFaces[cell]) continue;
    let red=0,green=0,blue=0,count=0;
    for (let y=0;y<scale;y++) for (let x=0;x<scale;x++) {
      const at=((row*scale+y)*imageWidth+col*scale+x)*4;
      if (!pixels[at+3]) continue;
      red+=pixels[at];
      green+=pixels[at+1];
      blue+=pixels[at+2];
      count++;
    }
    if (!count) continue;
    measuredPixels+=count;
    valid[cell]=Number(count===scale*scale && quality[cell]>0.44);
    colors[0][cell]=red/count;
    colors[1][cell]=green/count;
    colors[2][cell]=blue/count;
  }

  // Solve base colors separately from photo detail, then smooth the base
  // gently to avoid carrying individual source triangle edges into the fill.
  const base=colors.map(channel=>soften(completeField(channel,width,depth),width,depth,3));
  const distance=sampleDistance(valid.map(value=>1-value),width);
  const trust=soften(Float32Array.from(quality,(value,i)=>
    Math.min(1, value*1.45)*Math.min(1,(distance[i]+2)/5)),width,depth,4);
  const period=42;
  const donors=[];
  for (let y=9;y<depth-9;y+=6) for (let x=9;x<width-9;x+=6) {
    if (distance[y*width+x] < 2*Math.ceil(period/scale)+2) continue;
    const cx=x*scale+Math.floor(scale/2), cy=y*scale+Math.floor(scale/2);
    const sums=[0,0,0];
    let count=0, min=255,max=0,grain=0;
    for (let v=-period;v<period;v+=4) for (let u=-period;u<period;u+=4) {
      const at=((cy+v)*imageWidth+cx+u)*4;
      const luma=pixels[at+1];
      min=Math.min(min,luma);
      max=Math.max(max,luma);
      grain+=Math.abs(luma-pixels[at+5])+Math.abs(luma-pixels[at+imageWidth*4+1]);
      for (let c=0;c<3;c++) sums[c]+=pixels[at+c];
      count++;
    }
    if (max-min<9 || max-min>100 || grain/count<1.4) continue;
    donors.push({cx,cy,mean:sums.map(sum=>sum/count)});
  }
  if (!donors.length) throw new Error('No well-projected Navcam texture swatches for terrain completion');

  // Snapshot the source swatches before modifying any atlas pixels.
  const span=period*2+1;
  for (const donor of donors) {
    donor.detail=new Int8Array(span*span*3);
    for (let v=0;v<span;v++) for (let u=0;u<span;u++) {
      const at=((donor.cy+v-period)*imageWidth+donor.cx+u-period)*4;
      for (let c=0;c<3;c++) {
        donor.detail[(v*span+u)*3+c]=Math.max(-47,Math.min(47,Math.round(pixels[at+c]-donor.mean[c])));
      }
    }
  }
  const tileCols=Math.ceil(imageWidth/period)+1;
  const tileRows=Math.ceil(imageDepth/period)+1;
  let seed=671167;
  const patches=Array.from({length:tileCols*tileRows},(_,i)=>{
    const row=Math.min(depth-1,Math.floor(Math.floor(i/tileCols)*period/scale));
    const col=Math.min(width-1,Math.floor(i%tileCols*period/scale));
    const luma=base[1][row*width+col];
    let best, error=Infinity;
    for (let sample=0;sample<9;sample++) {
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const candidate=donors[(seed>>>8)%donors.length];
      const delta=Math.abs(candidate.mean[1]-luma);
      if (delta<error) {
        best=candidate;
        error=delta;
      }
    }
    return best.detail;
  });
  const smooth=t=>t*t*(3-2*t);
  const shade=reliefShade(heights,width,depth);
  const feather=photoBoundaryDistance(pixels,imageWidth);
  const grid=(field,row,below,col,right,u,v)=>
    (field[row*width+col]*(1-u)+field[row*width+right]*u)*(1-v)+
    (field[below*width+col]*(1-u)+field[below*width+right]*u)*v;
  for (let y=0;y<imageDepth;y++) {
    const tz=Math.floor(y/period), pz=y%period, vz=smooth(pz/period);
    const z=Math.max(0,y/scale-0.5), row=Math.floor(z), fz=z-row;
    const below=Math.min(depth-1,row+1);
    for (let x=0;x<imageWidth;x++) {
      const at=(y*imageWidth+x)*4;
      const u=Math.max(0,x/scale-0.5), col=Math.floor(u), fx=u-col;
      const right=Math.min(width-1,col+1);
      const edge=smooth(Math.min(1,feather[at/4]/15));
      const blend=edge*grid(trust,row,below,col,right,fx,fz);
      if (blend>0.995) continue;
      const tx=Math.floor(x/period), px=x%period, ux=smooth(px/period);
      const slot=tz*tileCols+tx;
      const a=patches[slot], b=patches[slot+1], c=patches[slot+tileCols], d=patches[slot+tileCols+1];
      const ai=((period+pz)*span+period+px)*3, bi=((period+pz)*span+px)*3;
      const ci=(pz*span+period+px)*3, di=(pz*span+px)*3;
      const w1=(1-ux)*(1-vz), w2=ux*(1-vz), w3=(1-ux)*vz, w4=ux*vz;
      // Power normalization preserves grain at overlapping patch centers.
      const strength=0.95/Math.sqrt(w1*w1+w2*w2+w3*w3+w4*w4);
      const relief=grid(shade,row,below,col,right,fx,fz);
      for (let channel=0;channel<3;channel++) {
        const tone=grid(base[channel],row,below,col,right,fx,fz);
        const detail=a[ai+channel]*w1+b[bi+channel]*w2+c[ci+channel]*w3+d[di+channel]*w4;
        const inferred=tone+strength*detail+relief;
        pixels[at+channel]=Math.max(0,Math.min(255,Math.round(inferred*(1-blend)+pixels[at+channel]*blend)));
      }
      pixels[at+3]=255;
    }
  }
  return {measuredPixels,inferredPixels:imageWidth*imageDepth-measuredPixels,textureSwatches:donors.length};
}

// Feather in image space as well as on the coarser terrain grid.
function photoBoundaryDistance(pixels,width) {
  const distance=new Uint8Array(pixels.length/4);
  for (let i=0;i<distance.length;i++) {
    if (!pixels[i*4+3]) continue;
    const left=i%width ? distance[i-1]+1 : 15;
    const top=i>=width ? distance[i-width]+1 : 15;
    distance[i]=Math.min(15,left,top);
  }
  for (let i=distance.length-1;i>=0;i--) {
    if (!distance[i]) continue;
    const right=i%width!==width-1 ? distance[i+1]+1 : 15;
    const bottom=i<distance.length-width ? distance[i+width]+1 : 15;
    distance[i]=Math.min(distance[i],right,bottom);
  }
  return distance;
}

function soften(field,width,depth,passes) {
  for (let pass=0;pass<passes;pass++) {
    const result=field.slice();
    for (let z=1;z<depth-1;z++) for (let x=1;x<width-1;x++) {
      const i=z*width+x;
      result[i]=field[i]*0.5+(field[i-1]+field[i+1]+field[i-width]+field[i+width])*0.125;
    }
    field=result;
  }
  return field;
}

function reliefShade(heights,width,depth) {
  const stride=width+1;
  const result=new Float32Array(width*depth);
  for (let z=1;z<depth-1;z++) for (let x=1;x<width-1;x++) {
    const i=z*stride+x;
    const dx=heights[i+1]-heights[i-1], dz=heights[i+stride]-heights[i-stride];
    const dip=(heights[i-1]+heights[i+1]+heights[i-stride]+heights[i+stride])*0.25-heights[i];
    result[z*width+x]=Math.max(-14,Math.min(9,90*(0.65*dx-0.45*dz)-160*Math.max(0,dip)));
  }
  return soften(result,width,depth,2);
}
