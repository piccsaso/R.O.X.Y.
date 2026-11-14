import fs from 'node:fs';
import {PNG} from 'pngjs';
import jpeg from 'jpeg-js';
import {sampleDistance} from './infill.mjs';
import {completeTexture} from './texture-infill.mjs';

export function bakeAtlas({sources,layers,width,depth,fused,filled,mask,agreement}) {
  const scale = 7;
  const imageWidth = (width-1)*scale;
  const imageHeight = (depth-1)*scale;
  const pixels = Buffer.alloc(imageWidth*imageHeight*4);
  const maps = layers.map((layer,j) => {
    const valid = new Uint8Array(fused.length);
    for (let i=0;i<fused.length;i++) {
      if (Math.abs(fused[i]-layer.heights[i])<=agreement) valid[i]=1;
    }
    if (!valid.some(Boolean)) return null;
    const support=sampleDistance(valid.map(value=>1-value),width);
    return {...layer,support,image:PNG.sync.read(fs.readFileSync('source/'+sources[j].id+'.png')),
      index:j};
  }).filter(Boolean);
  const quality = new Float32Array(mask.length);
  const counts = sources.map(() => 0);
  for (let row=0;row<depth-1;row++) for (let col=0;col<width-1;col++) {
    const flags = mask[row*(width-1)+col];
    if (!flags) continue;
    const a=row*width+col, b=a+1, c=a+width, d=c+1;
    const first = flags&1 ? pick([a,c,b], false) : [];
    const second = flags&2 ? pick([b,c,d], true) : [];
    quality[row*(width-1)+col] = (confidence(first)+confidence(second))*0.5;
    for (let y=0;y<scale;y++) for (let x=0;x<scale;x++) {
      const u=(x+0.5)/scale, v=(y+0.5)/scale;
      const front = u+v<1;
      const entries = front ? first : second;
      const weights = front ? [Math.max(0,1-u-v),v,u] : [1-v,1-u,Math.max(0,u+v-1)];
      const sum=weights[0]+weights[1]+weights[2];
      const pixel=((row*scale+y)*imageWidth+col*scale+x)*4;
      let red=0, green=0, blue=0, total=0;
      for (const entry of entries) {
        const {image}=entry;
        const s=(entry.uv[0]*weights[0]+entry.uv[2]*weights[1]+entry.uv[4]*weights[2])/sum;
        const t=(entry.uv[1]*weights[0]+entry.uv[3]*weights[1]+entry.uv[5]*weights[2])/sum;
        const sx=Math.max(0,Math.min(image.width-1,s*image.width-0.5));
        const sy=Math.max(0,Math.min(image.height-1,t*image.height-0.5));
        const left=Math.floor(sx), top=Math.floor(sy);
        const right=Math.min(left+1,image.width-1), bottom=Math.min(top+1,image.height-1);
        const fx=sx-left, fy=sy-top;
        const offsets=[top*image.width+left,top*image.width+right,bottom*image.width+left,bottom*image.width+right];
        const coeff=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy];
        let r=0,g=0,b=0;
        for (let k=0;k<4;k++) {
          const j=offsets[k]*4;
          r+=image.data[j]*coeff[k]; g+=image.data[j+1]*coeff[k]; b+=image.data[j+2]*coeff[k];
        }
        const fade=Math.min(1,(entry.support[0]*weights[0]+entry.support[1]*weights[1]+entry.support[2]*weights[2])/7);
        const weight=entry.weight*fade*fade;
        red+=r*weight;green+=g*weight;blue+=b*weight;total+=weight;
      }
      if (total) {
        pixels[pixel]=Math.round(red/total);
        pixels[pixel+1]=Math.round(green/total);
        pixels[pixel+2]=Math.round(blue/total);
        pixels[pixel+3]=255;
      }
    }
  }
  const coverage=completeTexture(pixels,width-1,depth-1,scale,mask,quality,filled);
  return {image:jpeg.encode({data:pixels,width:imageWidth,height:imageHeight},94).data,counts,coverage};

  function confidence(entries) {
    return entries.reduce((best,entry)=>Math.max(best,entry.confidence),0);
  }

  function pick(indices, second) {
    return maps.flatMap(layer => {
      const support=indices.map(i=>layer.support[i]);
      if (support.some(value=>!value)) return [];
      const uv=indices.flatMap(i=>[layer.texcoords[2*i],layer.texcoords[2*i+1]]);
      const {width:iw,height:ih}=layer.image;
      const dx=second ? 2 : 0;
      const dz=second ? 4 : 2;
      const ux=(uv[4]-uv[dx])*iw, vx=(uv[5]-uv[dx+1])*ih;
      const sz=(uv[dz]-uv[0])*iw, tz=(uv[dz+1]-uv[1])*ih;
      const norm2=ux*ux+vx*vx+sz*sz+tz*tz;
      const determinant=ux*tz-vx*sz;
      const major=Math.sqrt((norm2+Math.sqrt(Math.max(0,norm2**2-4*determinant**2)))*0.5);
      const minor=Math.abs(determinant)/Math.max(major,0.001);
      // A discontinuous or edge-on projection produces long streaks in the atlas.
      if (minor<0.32 || major>60) return [];
      const resolution=Math.min(1,minor/3);
      const distortion=Math.min(1,5*minor/major);
      const deviation=Math.max(...indices.map(i=>Math.abs(fused[i]-filled[i])));
      const coherence=1/(1+(deviation/0.14)**2);
      const confidence=resolution*distortion*coherence;
      const density=indices.reduce((sum,i)=>sum+layer.density[i],0)/3;
      const weight=(0.05+confidence)**2/Math.max(0.022,density);
      counts[layer.index]++;
      return [{image:layer.image,weight,uv,support,confidence}];
    });
  }
}
