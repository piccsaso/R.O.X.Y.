// This code was assisted through the use of SI.
function interpolate(field, width, depth, x, z) {
  const col = Math.min(width-1, Math.floor(x));
  const row = Math.min(depth-1, Math.floor(z));
  const right = Math.min(width-1, col+1);
  const bottom = Math.min(depth-1, row+1);
  const u = x-col, v = z-row;
  const upper = field[row*width+col]*(1-u)+field[row*width+right]*u;
  const lower = field[bottom*width+col]*(1-u)+field[bottom*width+right]*u;
  return upper*(1-v)+lower*v;
}

// Solve across the openings at several scales. Measured samples are fixed
// boundary conditions, and the outer edge has zero normal derivative.
export function completeField(samples, width, depth) {
  const levels = [{samples, width, depth}];
  while (width > 2 || depth > 2) {
    const cols = Math.ceil(width/2), rows = Math.ceil(depth/2);
    const reduced = new Float32Array(cols*rows).fill(NaN);
    for (let z=0;z<rows;z++) for (let x=0;x<cols;x++) {
      let sum=0, count=0;
      for (let v=2*z;v<Math.min(depth,2*z+2);v++) for (let u=2*x;u<Math.min(width,2*x+2);u++) {
        const value=samples[v*width+u];
        if (Number.isFinite(value)) {
          sum+=value;
          count++;
        }
      }
      if (count) reduced[z*cols+x]=sum/count;
    }
    levels.push({samples:reduced,width:cols,depth:rows});
    width=cols;
    depth=rows;
    samples=reduced;
  }
  const seeds = samples.filter(Number.isFinite);
  if (!seeds.length) throw new Error('Cannot infer a field without measured samples');
  const mean=seeds.reduce((sum,value)=>sum+value,0)/seeds.length;
  let coarse;
  for (const level of levels.reverse()) {
    const {width,depth,samples}=level;
    const field=new Float32Array(samples.length);
    const holes=[];
    for (let i=0;i<field.length;i++) {
      if (Number.isFinite(samples[i])) {
        field[i]=samples[i];
        continue;
      }
      holes.push(i);
      field[i]=coarse ? interpolate(coarse.field,coarse.width,coarse.depth,i%width/2,Math.floor(i/width)/2) : mean;
    }
    for (let pass=0;pass<36;pass++) for (const i of holes) {
      const x=i%width, z=Math.floor(i/width);
      const left=x ? field[i-1] : field[i];
      const right=x+1<width ? field[i+1] : field[i];
      const above=z ? field[i-width] : field[i];
      const below=z+1<depth ? field[i+width] : field[i];
      field[i]=(left+right+above+below)*0.25;
    }
    coarse={field,width,depth};
  }
  return coarse.field;
}

export function sampleDistance(valid, width) {
  const distance = Float32Array.from(valid, value => value ? 0 : Infinity);
  for (let i=0;i<distance.length;i++) {
    if (i%width) distance[i]=Math.min(distance[i],distance[i-1]+1);
    if (i>=width) distance[i]=Math.min(distance[i],distance[i-width]+1);
  }
  for (let i=distance.length-1;i>=0;i--) {
    if (i%width!==width-1) distance[i]=Math.min(distance[i],distance[i+1]+1);
    if (i<distance.length-width) distance[i]=Math.min(distance[i],distance[i+width]+1);
  }
  return distance;
}

export function completeHeights(heights, measuredFaces, width, depth, step) {
  const anchors=new Uint8Array(heights.length);
  const cols=width-1;
  for (let i=0;i<measuredFaces.length;i++) {
    const a=Math.floor(i/cols)*width+i%cols;
    const flags=measuredFaces[i];
    if (flags&1) anchors[a]=anchors[a+1]=anchors[a+width]=1;
    if (flags&2) anchors[a+1]=anchors[a+width]=anchors[a+width+1]=1;
  }
  const samples=Float32Array.from(heights,(height,i)=>anchors[i] ? height : NaN);
  const filled=completeField(samples,width,depth);
  const distance=sampleDistance(anchors,width);
  for (let i=0;i<filled.length;i++) {
    const x=i%width*step, z=Math.floor(i/width)*step;
    const fade=Math.min(1,distance[i]*step/0.85)**2;
    // Low amplitude sand undulations; local rock relief is copied jointly
    // with photo patches later, instead of unrelated sinusoidal bumps.
    const ripples=0.008*Math.sin(5.8*x+10.2*z+0.75*Math.sin(z*1.1))+
      0.018*Math.sin(x*1.1-z*0.7+0.4*Math.sin(z*0.6));
    filled[i]+=ripples*fade;
  }
  return filled;
}

// Limit the abrupt steps created when adjacent stereo wedges disagree.
// The original slab gets a steeper allowance so its outline is preserved.
export function softenStitchSteps(field, width, depth, step, slab) {
  const low=field.slice(), high=field.slice();
  const slopes=Float32Array.from(field,(_,i)=>{
    const x=i%width*step, z=Math.floor(i/width)*step;
    const dx=Math.max(slab.x0-x,0,x-slab.x1);
    const dz=Math.max(slab.z0-z,0,z-slab.z1);
    return 1.05+0.95*Math.max(0,1-Math.hypot(dx,dz)/0.7);
  });
  function update(i,j,run) {
    const rise=run*Math.min(slopes[i],slopes[j]);
    low[i]=Math.min(low[i],low[j]+rise);
    high[i]=Math.max(high[i],high[j]-rise);
  }
  const diagonal=step*Math.SQRT2;
  for (let pass=0;pass<2;pass++) {
    for (let i=0;i<field.length;i++) {
      const col=i%width;
      if (col) update(i,i-1,step);
      if (i<width) continue;
      update(i,i-width,step);
      if (col) update(i,i-width-1,diagonal);
      if (col+1<width) update(i,i-width+1,diagonal);
    }
    for (let i=field.length-1;i>=0;i--) {
      const col=i%width;
      if (col+1<width) update(i,i+1,step);
      if (i>=field.length-width) continue;
      update(i,i+width,step);
      if (col) update(i,i+width-1,diagonal);
      if (col+1<width) update(i,i+width+1,diagonal);
    }
  }
  return Float32Array.from(field,(_,i)=>(low[i]+high[i])*0.5);
}

// Remove small ridges left by the slope limiter. On sound stereo rock,
// the filter only touches sub-centimetre relief.
export function polishSurface(heights, original, width, depth) {
  const strength=Float32Array.from(heights,(height,i)=>{
    const disagreement=Math.abs(height-original[i]);
    return Number.isFinite(disagreement) ? 0.12+0.46*Math.min(1,disagreement/0.14) : 0.68;
  });
  let field=heights;
  for (let pass=0;pass<4;pass++) {
    const next=field.slice();
    for (let z=1;z<depth-1;z++) for (let x=1;x<width-1;x++) {
      const i=z*width+x, value=field[i];
      const limit=0.021+0.046*strength[i];
      const delta=[field[i-1]-value,field[i+1]-value,field[i-width]-value,field[i+width]-value];
      const correction=delta.reduce((sum,n)=>sum+Math.max(-limit,Math.min(limit,n)),0)*0.25;
      next[i]+=correction*strength[i];
    }
    field=next;
  }
  return field;
}
