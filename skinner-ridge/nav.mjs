// Route planning, prior-versus-scanned ground, and command parsing.
// Pure module: runs in the browser and in Node tests. Everything here reads
// the same heightfield the walker collides with (ground.mjs).
import {makeGround} from './ground.mjs';

// ASSUMPTION values. Each one is a planning choice, not a validated EVA number.
export const config = {
  cell: 0.14,            // m. Routing grid; four terrain samples per cell, same as route-check.mjs.
  walkSpeed: 1.1,        // m/s on flat ground. Matches the walker's speed.
  lane: 0.10,            // m. Half-width of the swept lane a shortcut must keep clear.
  priorWindow: 1.0,      // m. Averaging window that stands in for orbital-resolution knowledge.
  scanRange: 7,          // m. Simulated scanner range.
  offRoute: 1.5,         // m. Re-plan when the walker strays this far from the route.
  arrive: 0.7,           // m. Arrival radius.
  evaBudgetMin: 4,       // min. Demo consumables budget for the safe-return gauge.
  reserve: 0.25          // fraction of the budget held back.
};

// Tobler-style slope speed factor, normalised so flat ground is 1.
const speedFactor = grade => Math.exp(-3.5*Math.abs(grade+0.05))/Math.exp(-0.175);
const maxFactor = 1/Math.exp(-0.175);

// What was "known before the walk": the rover surface averaged over ~1 m,
// which is the post spacing of the HiRISE elevation product for this area.
// It is a stand-in computed from the rover data, not the orbital product itself.
export function makePriorGround(meta, data) {
  const {width, depth, step} = meta;
  const source = new Float32Array(data, 0, width*depth);
  const radius = Math.max(1, Math.round(config.priorWindow/step/2));
  const pass = new Float32Array(width*depth), out = new Float32Array(width*depth);
  const blur = (from, to, count, stride, lines, lineStride) => {
    for (let line=0; line<lines; line++) {
      const base = line*lineStride;
      let sum = 0, n = 0;
      for (let i=0; i<=radius && i<count; i++) { sum += from[base+i*stride]; n++; }
      for (let i=0; i<count; i++) {
        to[base+i*stride] = sum/n;
        const add = i+radius+1, drop = i-radius;
        if (add<count) { sum += from[base+add*stride]; n++; }
        if (drop>=0) { sum -= from[base+drop*stride]; n--; }
      }
    }
  };
  blur(source, pass, width, 1, depth, width);
  blur(pass, out, depth, width, width, 1);
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(new Uint8Array(data));
  new Float32Array(buffer, 0, width*depth).set(out);
  return makeGround(meta, buffer);
}

export function makeNav(meta, truth, prior) {
  const [width, depth] = meta.boundsMeters;
  const cell = config.cell;
  const cols = Math.floor(width/cell), rows = Math.floor(depth/cell);
  const count = cols*rows;
  const scanned = new Uint8Array(count);
  const okTruth = new Uint8Array(count), okPrior = new Uint8Array(count);
  for (let i=0; i<count; i++) {
    const x = (i%cols+0.5)*cell, z = (Math.floor(i/cols)+0.5)*cell;
    okTruth[i] = Number.isFinite(truth.foot(x,z)) ? 1 : 0;
    okPrior[i] = prior && Number.isFinite(prior.foot(x,z)) ? 1 : 0;
  }
  const index = (x,z) => {
    const c = Math.floor(x/cell), r = Math.floor(z/cell);
    return c<0 || r<0 || c>=cols || r>=rows ? -1 : r*cols+c;
  };
  const center = i => [(i%cols+0.5)*cell, (Math.floor(i/cols)+0.5)*cell];
  // The working ground is the prior until a cell has been scanned.
  const pick = (x,z) => { const i = index(x,z); return !prior || (i>=0 && scanned[i]) ? truth : prior; };
  const working = {
    foot: (x,z) => pick(x,z).foot(x,z),
    sample: (x,z) => pick(x,z).sample(x,z)
  };
  const known = () => prior ? working : truth;
  const ok = i => (!prior || scanned[i]) ? okTruth[i] : okPrior[i];

  function clear(ground, ax, az, bx, bz, lane=0) {
    const length = Math.hypot(bx-ax, bz-az);
    const steps = Math.max(1, Math.ceil(length/meta.step));
    const nx = length ? -(bz-az)/length : 0, nz = length ? (bx-ax)/length : 0;
    for (let s=0; s<=steps; s++) {
      const t = s/steps, x = ax+(bx-ax)*t, z = az+(bz-az)*t;
      for (const off of lane ? [0,-lane,lane] : [0]) {
        if (!Number.isFinite(ground.foot(x+nx*off, z+nz*off))) return {t, x, z};
      }
    }
    return null;
  }

  function nearestOk(x, z, reach=1.2) {
    const c0 = Math.floor(x/cell), r0 = Math.floor(z/cell), span = Math.ceil(reach/cell);
    let best = -1, bestD = Infinity;
    for (let r=r0-span; r<=r0+span; r++) for (let c=c0-span; c<=c0+span; c++) {
      if (c<0 || r<0 || c>=cols || r>=rows || !ok(r*cols+c)) continue;
      const d = Math.hypot((c+0.5)*cell-x, (r+0.5)*cell-z);
      if (d<bestD) { bestD = d; best = r*cols+c; }
    }
    return best;
  }

  function astar(start, goal) {
    const ground = known();
    const g = new Float32Array(count).fill(Infinity), from = new Int32Array(count).fill(-1);
    const closed = new Uint8Array(count);
    const heap = [];  // binary heap of [f, index]
    const push = (f,i) => { heap.push([f,i]); let n = heap.length-1;
      while (n>0) { const p = (n-1)>>1; if (heap[p][0]<=heap[n][0]) break; [heap[p],heap[n]] = [heap[n],heap[p]]; n = p; } };
    const pop = () => { const top = heap[0], last = heap.pop();
      if (heap.length) { heap[0] = last; let n = 0;
        for (;;) { let m = n; const l = 2*n+1, r = l+1;
          if (l<heap.length && heap[l][0]<heap[m][0]) m = l;
          if (r<heap.length && heap[r][0]<heap[m][0]) m = r;
          if (m===n) break; [heap[m],heap[n]] = [heap[n],heap[m]]; n = m; } }
      return top; };
    const [gx,gz] = center(goal);
    const h = i => { const [x,z] = center(i); return Math.hypot(x-gx,z-gz)/(config.walkSpeed*maxFactor); };
    g[start] = 0; push(h(start), start);
    while (heap.length) {
      const [,i] = pop();
      if (closed[i]) continue;
      closed[i] = 1;
      if (i===goal) break;
      const c = i%cols, r = Math.floor(i/cols), [x,z] = center(i), y = ground.foot(x,z);
      for (let dr=-1; dr<=1; dr++) for (let dc=-1; dc<=1; dc++) {
        if (!dr && !dc) continue;
        const u = c+dc, v = r+dr, n = v*cols+u;
        if (u<0 || v<0 || u>=cols || v>=rows || closed[n] || !ok(n)) continue;
        // No corner cutting: a diagonal needs both orthogonal neighbours.
        if (dr && dc && (!ok(r*cols+u) || !ok(v*cols+c))) continue;
        const [nx,nz] = center(n);
        if (clear(ground, x, z, nx, nz)) continue;
        const dist = Math.hypot(nx-x, nz-z), ny = ground.foot(nx,nz);
        const cost = g[i] + dist/(config.walkSpeed*speedFactor((ny-y)/dist));
        if (cost<g[n]) { g[n] = cost; from[n] = i; push(cost+h(n), n); }
      }
    }
    if (!closed[goal]) return null;
    const cells = [];
    for (let i=goal; i>=0; i=from[i]) cells.push(i);
    return cells.reverse().map(center);
  }

  // Line-of-sight shortcuts. A shortcut is kept only if a swept lane is clear.
  function smooth(points) {
    const ground = known(), out = [points[0]];
    let anchor = 0;
    while (anchor<points.length-1) {
      let next = anchor+1;
      for (let j=points.length-1; j>anchor+1; j--) {
        if (!clear(ground, ...points[anchor], ...points[j], config.lane)) { next = j; break; }
      }
      out.push(points[next]);
      anchor = next;
    }
    return out;
  }

  function measure(points) {
    const ground = known();
    let distance = 0, time = 0, gain = 0, loss = 0, maxSlope = 0, inferred = 0, samples = 0;
    const dense = [];
    for (let k=0; k<points.length-1; k++) {
      const [ax,az] = points[k], [bx,bz] = points[k+1];
      const length = Math.hypot(bx-ax,bz-az), steps = Math.max(1, Math.ceil(length/cell));
      for (let s=0; s<steps; s++) {
        const x0 = ax+(bx-ax)*s/steps, z0 = az+(bz-az)*s/steps;
        const x1 = ax+(bx-ax)*(s+1)/steps, z1 = az+(bz-az)*(s+1)/steps;
        const y0 = ground.foot(x0,z0) ?? ground.sample(x0,z0)?.height ?? 0;
        const y1 = ground.foot(x1,z1) ?? ground.sample(x1,z1)?.height ?? y0;
        const d = length/steps, dy = y1-y0;
        distance += d; time += d/(config.walkSpeed*speedFactor(dy/d));
        if (dy>0) gain += dy; else loss -= dy;
        maxSlope = Math.max(maxSlope, Math.atan(Math.abs(dy)/d)*180/Math.PI);
        dense.push([x0,y0,z0]);
        samples++;
        if (nav.inferredAt?.(x0,z0)) inferred++;
        if (k===points.length-2 && s===steps-1) dense.push([x1,y1,z1]);
      }
    }
    if (!dense.length) { const [x,z] = points[0]; dense.push([x, ground.foot(x,z) ?? 0, z]); }
    return {distance, time, gain, loss, maxSlope, inferredShare: samples ? inferred/samples : 0, dense};
  }

  // Name what is actually in the way, from the real surface.
  function describeBlock(x, z) {
    const centre = truth.sample(x,z);
    if (!centre) return 'the edge of the mapped terrain';
    let low = centre.height, high = centre.height, missing = false;
    for (let a=0; a<8; a++) {
      const p = truth.sample(x+0.16*Math.cos(a*Math.PI/4), z+0.16*Math.sin(a*Math.PI/4));
      if (!p) { missing = true; continue; }
      low = Math.min(low,p.height); high = Math.max(high,p.height);
    }
    if (missing) return 'the edge of the mapped terrain';
    return 'a '+Math.round((high-low)*100)+' cm rock step';
  }

  function plan(fromXZ, toXZ) {
    const start = nearestOk(fromXZ[0], fromXZ[1]);
    const goal = nearestOk(toXZ[0], toXZ[1], 2.5);
    if (start<0) return {error:'No walkable ground at the current position.'};
    if (goal<0) return {error:'No walkable route found: the destination is enclosed by ground that cannot be walked.'};
    const cells = astar(start, goal);
    if (!cells) return {error:'No walkable route found: the destination is cut off by steps or unmapped ground.'};
    const points = smooth([[fromXZ[0],fromXZ[1]], ...cells.slice(1)]);
    const summary = measure(points);
    const end = points[points.length-1];
    const straight = Math.hypot(end[0]-fromXZ[0], end[1]-fromXZ[1]);
    const hit = clear(known(), fromXZ[0], fromXZ[1], end[0], end[1], config.lane);
    let reason = 'Direct route: the straight line is clear.';
    if (hit && summary.distance-straight>0.3) {
      reason = 'Detours +'+(summary.distance-straight).toFixed(1)+' m around '+describeBlock(hit.x,hit.z)+
        ' '+(hit.t*straight).toFixed(1)+' m along the straight line.';
    } else if (hit) reason = 'Bends around '+describeBlock(hit.x,hit.z)+'.';
    return {points, ...summary, straight, reason, usesPrior: !!prior && summary.dense.some(([x,,z]) => !scanned[index(x,z)])};
  }

  // First place where the remaining route fails on what is now known.
  function firstBlock(dense, fromIndex=0) {
    const ground = known();
    for (let i=Math.max(0,fromIndex); i<dense.length-1; i++) {
      const hit = clear(ground, dense[i][0], dense[i][2], dense[i+1][0], dense[i+1][2]);
      if (hit) return {x:hit.x, z:hit.z, what:describeBlock(hit.x,hit.z)};
    }
    return null;
  }

  // Simulated scanner: rays over the measured surface with terrain occlusion.
  function scan(x, z, eyeY) {
    let fresh = 0;
    const mark = (px,pz) => { const i = index(px,pz); if (i>=0 && !scanned[i]) { scanned[i] = 1; fresh++; } };
    for (let dz=-1.5; dz<=1.5; dz+=cell) for (let dx=-1.5; dx<=1.5; dx+=cell) {
      if (dx*dx+dz*dz<=2.25) mark(x+dx, z+dz);
    }
    const rays = 180;
    for (let k=0; k<rays; k++) {
      const a = k*2*Math.PI/rays, cx = Math.cos(a), cz = Math.sin(a);
      let horizon = -Infinity;
      for (let d=cell; d<=config.scanRange; d+=cell) {
        const px = x+cx*d, pz = z+cz*d, s = truth.sample(px,pz);
        if (!s) break;
        const angle = (s.height-eyeY)/d;
        if (angle>=horizon-0.02) mark(px,pz);
        horizon = Math.max(horizon, angle);
      }
    }
    return fresh;
  }

  const nav = {cols, rows, cell, scanned, okTruth, okPrior, ok, index, center, working, known, plan, measure,
    firstBlock, scan, describeBlock, clear, hasPrior: !!prior, truth,
    scanAll() { scanned.fill(1); }, resetScan() { scanned.fill(0); }};
  return nav;
}

// ---- Landmarks and commands -------------------------------------------------

export function makeLandmarks(route) {
  const slab = [route.spawn.targetX, route.spawn.targetZ];
  return [
    {id:'slab', name:'Layered slab', aliases:['slab','pale slab','layered rock','the rock','rock'],
      position:slab, face:slab,
      science:'A pale, layered slab in Perseverance\'s Skinner Ridge workspace at Hawksbill Gap, on the Jezero delta front. '+
        'Position measured in this mesh from Navcam stereo products (sols 470 to 501, SITE_FRAME 26). '+
        'It has no verified individual NASA feature name.',
      link:'https://science.nasa.gov/resource/perseverance-workspace-at-skinner-ridge/', linkText:'NASA: Perseverance workspace at Skinner Ridge'},
    {id:'outcrop', name:'Outcrop band', aliases:['outcrop','ridge','ledge','ledges','rock band','the ridge'],
      position:[17,15.3], viewing:[[17,12.6],[17,18.6]], face:[17,15.3], blocked:true,
      science:'A band of stepped, layered rock that crosses the patch from west to east. The stereo-derived surface has '+
        'steps here that exceed the walking limit, so routes go around it. Team label, not a NASA feature name.',
      link:'https://science.nasa.gov/resource/perseverance-workspace-at-skinner-ridge/', linkText:'NASA: Perseverance workspace at Skinner Ridge'},
    {id:'bench', name:'Upper bench', aliases:['bench','upper bench','north west','northwest','above the outcrop','top'],
      position:[19,20.5], face:[17,15.3]},
    {id:'start', name:'Start point', aliases:['start','home','base','beginning','spawn'],
      position:[route.spawn.x,route.spawn.z], face:slab},
    {id:'lookback', name:'Look-back point', aliases:['look back','lookback','look-back','far side of the slab'],
      position:[route.return.x,route.return.z], face:slab},
    {id:'corner', name:'South-east corner', aliases:['corner','south east','southeast','far corner','expansion'],
      position:[route.expansion.end.x,route.expansion.end.z], face:slab},
    {id:'east', name:'East edge', aliases:['east','east edge','inferred ground','infill'],
      position:[route.infill.end.x,route.infill.end.z], face:slab}
  ];
}

const normal = text => text.toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
function editDistance(a, b) {
  const row = Array.from({length:b.length+1}, (_,i) => i);
  for (let i=1; i<=a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j=1; j<=b.length; j++) {
      const keep = row[j];
      row[j] = Math.min(row[j]+1, row[j-1]+1, prev+(a[i-1]===b[j-1] ? 0 : 1));
      prev = keep;
    }
  }
  return row[b.length];
}

export function findLandmark(text, landmarks) {
  const query = normal(text).replace(/\b(the|a|an|to|please|point)\b/g,' ').replace(/\s+/g,' ').trim();
  if (!query) return {matches:[]};
  const scored = landmarks.map(landmark => {
    let best = Infinity;
    for (const name of [landmark.name, ...landmark.aliases].map(normal)) {
      if (name===query) best = 0;
      else if (name.includes(query) || query.includes(name)) best = Math.min(best, 0.2);
      else best = Math.min(best, editDistance(name,query)/Math.max(name.length,query.length));
    }
    return {landmark, score:best};
  }).filter(entry => entry.score<=0.4).sort((a,b) => a.score-b.score);
  const ambiguous = scored.length>1 && scored[1].score-scored[0].score<0.1;
  return {matches:scored.map(entry => entry.landmark), ambiguous};
}

const layerWords = {hazard:['hazard','hazards','obstacle','obstacles','danger'], slope:['slope','slopes','steep'],
  truth:['ground truth','truth','provenance','coverage','measured'], scan:['scan','scanner','scanned','lidar']};

export function parseCommand(text, landmarks) {
  const t = normal(text);
  if (!t) return {type:'none'};
  if (/\b(clear|cancel|stop)\b.*\b(route|navigation)\b|^cancel$|^clear$/.test(t)) return {type:'clear'};
  if (/\b(return|go back|back)\b.*\b(start|home|base)\b|^go home$|^return$/.test(t)) {
    return {type:'goto', landmark:landmarks.find(l => l.id==='start')};
  }
  if (/\b(map|plan|planning|overview)\b/.test(t) && !/\b(take|go|route|navigate)\b/.test(t)) return {type:'map'};
  if (/^(walk|resume|first person|enter)\b/.test(t)) return {type:'walk'};
  if (/\b(mute|quiet|silence)\b/.test(t)) return {type:'mute', on:!/\bun ?mute\b/.test(t)};
  if (/\bunmute\b/.test(t)) return {type:'mute', on:false};
  const toggle = /\b(show|hide|display|turn on|turn off|enable|disable)\b/.exec(t);
  if (toggle) {
    const on = !/hide|off|disable/.test(toggle[1]);
    for (const [layer, words] of Object.entries(layerWords)) {
      if (words.some(word => t.includes(word))) return {type:'layer', layer, on};
    }
    if (/\b(layers?|highlights?|overlay)\b/.test(t) && !on) return {type:'layer', layer:null, on:false};
  }
  const go = /\b(?:take me to|go to|navigate to|route to|walk to|head to|guide me to)\b(.*)$/.exec(t);
  const target = go ? go[1] : t;
  const found = findLandmark(target, landmarks);
  if (found.matches.length && (go || found.matches.length===1 || !found.ambiguous)) {
    return found.ambiguous ? {type:'choose', options:found.matches} : {type:'goto', landmark:found.matches[0]};
  }
  if (go) return {type:'unknown', message:'No landmark called "'+go[1].trim()+'" in this scene. Try: '+landmarks.map(l => l.name).join(', ')+'.'};
  return {type:'unknown', message:'Command not understood. Try "take me to the slab", "show hazards", "map" or "clear route".'};
}
