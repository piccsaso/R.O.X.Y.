export function makeGround(meta, data) {
  const {width, depth, step} = meta;
  const heights = new Float32Array(data, 0, width*depth);
  const mask = new Uint8Array(data, width*depth*4);

  function sample(x,z) {
    const gx = x/step, gz = z/step;
    const col = Math.floor(gx), row = Math.floor(gz);
    if (col < 0 || row < 0 || col >= width-1 || row >= depth-1) return;
    const i = row*width+col;
    const coverage = mask[row*(width-1)+col];
    const u = gx-col, v = gz-row;
    let height, dx, dz;
    if (u+v < 1) {
      if (!(coverage & 1)) return;
      const a=heights[i], b=heights[i+1], c=heights[i+width];
      dx=b-a; dz=c-a; height=a+u*dx+v*dz;
    } else {
      if (!(coverage & 2)) return;
      const b=heights[i+1], c=heights[i+width], d=heights[i+width+1];
      dx=d-c; dz=d-b; height=d-(1-u)*dx-(1-v)*dz;
    }
    return {height,slope:Math.hypot(dx,dz)/step};
  }

  function foot(x,z) {
    const center = sample(x,z);
    if (!center) return;
    let low=center.height, high=center.height;
    for (let angle=0;angle<8;angle++) {
      const a = angle*Math.PI/4;
      const p = sample(x+0.16*Math.cos(a), z+0.16*Math.sin(a));
      if (!p || Math.abs(p.height-center.height)>0.17) return;
      low=Math.min(low,p.height);
      high=Math.max(high,p.height);
    }
    if (high-low>0.25) return;
    return center.height;
  }
  return {sample,foot};
}
