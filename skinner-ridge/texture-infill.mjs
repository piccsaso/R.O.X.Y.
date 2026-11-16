// This code was assisted through the use of SI.
import {completeField, sampleDistance} from './infill.mjs';
import {quiltSurface} from './terrain-synthesis.mjs';

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
  const quilt=quiltSurface(pixels,width,depth,scale,quality,measuredFaces,heights);
  const smooth=t=>t*t*(3-2*t);
  const shade=reliefShade(heights,width,depth);
  const feather=photoBoundaryDistance(pixels,imageWidth);
  const grid=(field,row,below,col,right,u,v)=>
    (field[row*width+col]*(1-u)+field[row*width+right]*u)*(1-v)+
    (field[below*width+col]*(1-u)+field[below*width+right]*u)*v;
  for (let y=0;y<imageDepth;y++) {

    const z=Math.max(0,y/scale-0.5), row=Math.floor(z), fz=z-row;
    const below=Math.min(depth-1,row+1);
    for (let x=0;x<imageWidth;x++) {
      const at=(y*imageWidth+x)*4;
      const u=Math.max(0,x/scale-0.5), col=Math.floor(u), fx=u-col;
      const right=Math.min(width-1,col+1);
      const edge=smooth(Math.min(1,feather[at/4]/15));
      const blend=edge*grid(trust,row,below,col,right,fx,fz);
      if (blend>0.995) continue;
      const relief=grid(shade,row,below,col,right,fx,fz);
      for (let channel=0;channel<3;channel++) {
        const tone=grid(base[channel],row,below,col,right,fx,fz);
        const detail=quilt.texture[(at/4)*3+channel];
        const inferred=tone+detail+relief*0.35;
        pixels[at+channel]=Math.max(0,Math.min(255,Math.round(inferred*(1-blend)+pixels[at+channel]*blend)));
      }
      pixels[at+3]=255;
    }
  }
  return {measuredPixels,inferredPixels:imageWidth*imageDepth-measuredPixels,textureSwatches:quilt.donorCount,patchMeters:quilt.patchMeters,donorCells:quilt.donorCells};
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
