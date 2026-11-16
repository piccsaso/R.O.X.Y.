// This code was generated through the use of SI.
// Route planning and command parsing for the Skinner Ridge walk.
// Pure module: runs in the browser and in Node tests. It reads the same
// ground the walker stands on.

// ASSUMPTION values. Planning choices, not validated EVA numbers.
export const config = {
  cell: 0.2,          // m. Routing grid.
  margin: 20,         // m. Routing area extends this far past the measured patch onto the context terrain.
  walkSpeed: 2.6,     // m/s on flat ground. Matches the walker.
  stepLimit: 0.17,    // m. Height change across a 16 cm footprint that counts as unsafe footing.
  steepPenalty: 12,   // Cost multiplier for crossing unsafe footing. The safe route avoids it unless there is no other way.
  arrive: 1.6,        // m. Arrival radius.
  o2Minutes: 12,      // min. Simulated oxygen supply.
  powerMinutes: 16,   // min. Simulated suit power.
  reserve: 0.2        // fraction of the supply held back.
};

// Tobler-style slope speed factor, normalised so flat ground is 1.
const speedFactor = grade => Math.exp(-3.5*Math.abs(grade+0.05))/Math.exp(-0.175);
const maxFactor = 1/Math.exp(-0.175);

export function makeNav(meta, ground) {
  const [width, depth] = meta.boundsMeters;
  const cell = config.cell, x0 = -config.margin, z0 = -config.margin;
  const cols = Math.floor((width+2*config.margin)/cell), rows = Math.floor((depth+2*config.margin)/cell);
  const count = cols*rows;
  const height = new Float32Array(count), unsafe = new Uint8Array(count);
  const center = i => [x0+(i%cols+0.5)*cell, z0+(Math.floor(i/cols)+0.5)*cell];
  const index = (x,z) => {
    const c = Math.floor((x-x0)/cell), r = Math.floor((z-z0)/cell);
    return c<0 || r<0 || c>=cols || r>=rows ? -1 : r*cols+c;
  };
  // Unsafe footing: the surface steps by more than the limit within a 16 cm footprint.
  function footing(x, z) {
    const centre = ground.sample(x,z);
    if (!centre) return null;
    let low = centre.height, high = centre.height;
    for (let a=0; a<8; a++) {
      const p = ground.sample(x+0.16*Math.cos(a*Math.PI/4), z+0.16*Math.sin(a*Math.PI/4));
      if (!p) continue;
      low = Math.min(low,p.height); high = Math.max(high,p.height);
    }
    return {height:centre.height, step:high-low, slope:centre.slope};
  }
  for (let i=0; i<count; i++) {
    const f = footing(...center(i));
    if (!f) { height[i] = NaN; unsafe[i] = 2; continue; }
    height[i] = f.height;
    unsafe[i] = f.step>config.stepLimit ? 1 : 0;
  }

  function astar(start, goal) {
    const g = new Float32Array(count).fill(Infinity), from = new Int32Array(count).fill(-1), closed = new Uint8Array(count);
    const heapF = [], heapI = [];
    const push = (f,i) => { let n = heapF.length; heapF.push(f); heapI.push(i);
      while (n>0) { const p = (n-1)>>1; if (heapF[p]<=heapF[n]) break;
        [heapF[p],heapF[n]] = [heapF[n],heapF[p]]; [heapI[p],heapI[n]] = [heapI[n],heapI[p]]; n = p; } };
    const pop = () => { const top = heapI[0], lastF = heapF.pop(), lastI = heapI.pop();
      if (heapF.length) { heapF[0] = lastF; heapI[0] = lastI; let n = 0;
        for (;;) { let m = n; const l = 2*n+1, r = l+1;
          if (l<heapF.length && heapF[l]<heapF[m]) m = l;
          if (r<heapF.length && heapF[r]<heapF[m]) m = r;
          if (m===n) break;
          [heapF[m],heapF[n]] = [heapF[n],heapF[m]]; [heapI[m],heapI[n]] = [heapI[n],heapI[m]]; n = m; } }
      return top; };
    const gc = goal%cols, gr = Math.floor(goal/cols), fastest = config.walkSpeed*maxFactor;
    const h = i => Math.hypot(i%cols-gc, Math.floor(i/cols)-gr)*cell/fastest;
    g[start] = 0; push(h(start), start);
    while (heapF.length) {
      const i = pop();
      if (closed[i]) continue;
      closed[i] = 1;
      if (i===goal) break;
      const c = i%cols, r = Math.floor(i/cols);
      for (let dr=-1; dr<=1; dr++) for (let dc=-1; dc<=1; dc++) {
        if (!dr && !dc) continue;
        const u = c+dc, v = r+dr, n = v*cols+u;
        if (u<0 || v<0 || u>=cols || v>=rows || closed[n] || unsafe[n]===2) continue;
        // No corner cutting past unsafe footing.
        if (dr && dc && (unsafe[r*cols+u] || unsafe[v*cols+c]) && !unsafe[n]) continue;
        const dist = cell*(dr && dc ? Math.SQRT2 : 1);
        const cost = g[i]+dist/(config.walkSpeed*speedFactor((height[n]-height[i])/dist))*(unsafe[n] ? config.steepPenalty : 1);
        if (cost<g[n]) { g[n] = cost; from[n] = i; push(cost+h(n), n); }
      }
    }
    if (!closed[goal]) return null;
    const cells = [];
    for (let i=goal; i>=0; i=from[i]) cells.push(i);
    return cells.reverse().map(center);
  }

  // True when the straight segment stays on safe footing.
  function safeLine(ax, az, bx, bz) {
    const steps = Math.max(1, Math.ceil(Math.hypot(bx-ax,bz-az)/(cell/2)));
    for (let s=0; s<=steps; s++) {
      const i = index(ax+(bx-ax)*s/steps, az+(bz-az)*s/steps);
      if (i<0 || unsafe[i]) return false;
    }
    return true;
  }
  function smooth(points) {
    const out = [points[0]];
    let anchor = 0;
    while (anchor<points.length-1) {
      let next = anchor+1;
      for (let j=Math.min(points.length-1, anchor+60); j>anchor+1; j--) {
        if (safeLine(...points[anchor], ...points[j])) { next = j; break; }
      }
      out.push(points[next]);
      anchor = next;
    }
    return out;
  }

  function measure(points) {
    let distance = 0, time = 0, gain = 0, unsafeDistance = 0, maxSlope = 0;
    const dense = [];
    const y = (x,z) => ground.sample(x,z)?.height ?? 0;
    for (let k=0; k<points.length-1; k++) {
      const [ax,az] = points[k], [bx,bz] = points[k+1];
      const length = Math.hypot(bx-ax,bz-az), steps = Math.max(1, Math.ceil(length/cell));
      for (let s=0; s<steps; s++) {
        const xa = ax+(bx-ax)*s/steps, za = az+(bz-az)*s/steps, xb = ax+(bx-ax)*(s+1)/steps, zb = az+(bz-az)*(s+1)/steps;
        const ya = y(xa,za), yb = y(xb,zb), d = length/steps, dy = yb-ya;
        if (!d) continue;
        distance += d; time += d/(config.walkSpeed*speedFactor(dy/d));
        if (dy>0) gain += dy;
        maxSlope = Math.max(maxSlope, Math.atan(Math.abs(dy)/d)*180/Math.PI);
        const i = index(xb,zb);
        if (i<0 || unsafe[i]) unsafeDistance += d;
        dense.push([xa,ya,za]);
        if (k===points.length-2 && s===steps-1) dense.push([xb,yb,zb]);
      }
    }
    if (!dense.length) dense.push([points[0][0], y(...points[0]), points[0][1]]);
    return {points, distance, time, gain, unsafeDistance, maxSlope, dense};
  }

  const straight = (from, to) => measure([from, to]);
  function safe(from, to) {
    const start = index(...from), goal = index(...to);
    if (start<0 || goal<0 || unsafe[start]===2 || unsafe[goal]===2) return null;
    const cells = astar(start, goal);
    if (!cells) return null;
    return measure(smooth([from, ...cells.slice(1,-1), to]));
  }

  return {cols, rows, cell, x0, z0, count, height, unsafe, index, center, footing, straight, safe,
    extent:[x0, z0, cols*cell, rows*cell]};
}

// ---- Landmarks and commands -------------------------------------------------

// Positions are local metres on this mesh. Names are team labels, not NASA feature names.
export function makeLandmarks(route) {
  return [
    {id:'summit', name:'Ridge summit', aliases:['summit','ridge','hill','hilltop','top of the hill','the top','peak','goal','destination'], position:[42,41]},
    {id:'base', name:'Home Base', aliases:['home','base','home base','start','lander','habitat'], position:[route.start.x, route.start.z]},
    {id:'slab', name:'Layered slab', aliases:['slab','pale slab','layered rock','rock'], position:[route.spawn.targetX, route.spawn.targetZ]},
    {id:'lower', name:'Lower path', aliases:['lower path','lower','path'], position:[route.lowerPath.end.x, route.lowerPath.end.z]}
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
  return {matches:scored.map(entry => entry.landmark)};
}

export function matchRoxyWake(text) {
  return /^\s*(?:(?:hey|hi|okay|ok)[\s,.!?]+)?(roxy|roxie|roxi|rocksy|rocksie|rock\s*(?:sea|see)|rox\s*y|rocky|rox)\b[\s,.!?]*/i.exec(text);
}

export function selectVoiceTranscript(alternatives, armed, landmarks) {
  const eligible=alternatives.filter(text=>armed || matchRoxyWake(text));
  return eligible.find(text=>{
    const wake=matchRoxyWake(text);
    const command=wake ? text.slice(wake[0].length) : text;
    return !['unknown','none'].includes(parseCommand(command,landmarks).type);
  }) ?? eligible[0] ?? alternatives[0] ?? '';
}

export function parseCommand(text, landmarks) {
  const t = normal(text).replace(/^(?:(?:please|can you|could you|would you)\s+)+/, '')
    .replace(/\btraffic ability\b/g,'trafficability').replace(/\bover lays?\b/g,'overlays')
    .replace(/\btopo graphy\b/g,'topography');
  if (!t) return {type:'none'};
  if (/\b(clear|cancel|remove)\b.*\b(route|path|navigation)\b|^cancel$|^clear$/.test(t)) return {type:'clear'};
  if (/\b(low|drain|simulate)\b.*\b(oxygen|o2|power|fuel)\b/.test(t)) return {type:'drain'};
  if (/\bunmute\b|\bsound on\b/.test(t)) return {type:'mute', on:false};
  if (/^mute$/.test(t)) return {type:'mute', on:'toggle'};
  if (/\b(mute|quiet|silence)\b/.test(t)) return {type:'mute', on:true};
  if (/^(close|exit|back|go back|close map|close the map|close menu|never ?mind)$/.test(t)) return {type:'close'};
  if (/\breset\b/.test(t)) return {type:'reset'};
  const menu = /^(?:please )?(?:open |show |bring up )?(?:the )?(options|routes|overlays?|layers?)(?: menu| tab| panel)?(?: please)?$/.exec(t);
  if (menu) return {type:'menu', menu:/^(overlay|layer)/.test(menu[1]) ? 'layers' : menu[1]};
  // Saying just the name toggles; "show" or "hide" sets it.
  const on = /\b(hide|off|disable|remove|close|deactivate|invisible)\b|\bnot visible\b/.test(t) ? false : /\b(show|on|enable|display|open|activate|visible)\b|\b(go|switch|take me) to\b/.test(t) ? true : 'toggle';
  if (/\btrafficability\b|\btraffic\b|\btraversability\b|\bhazards?\b/.test(t)) return {type:'layer', layer:'traffic', on};
  if (/\bminerals?\b|\bresources?\b/.test(t)) return {type:'layer', layer:'minerals', on};
  if (/\bthermals?\b|\bregolith\b|\binfrared\b/.test(t)) return {type:'layer', layer:'thermal', on};
  if (/\btopograph(?:y|ic)\b|\btopo\b|\belevation\b/.test(t)) return {type:'layer', layer:'topo', on};
  if (/\bslopes?\b|\bsteep\b/.test(t)) return {type:'layer', layer:'slope', on};
  if (/\bground truth\b|\bprovenance\b|\bmeasured\b/.test(t)) return {type:'layer', layer:'truth', on};
  if (/\b(straight|direct)\b/.test(t)) return {type:'route', which:'straight', on};
  if (/\b(voice|custom|saved) (route|path)\b/.test(t)) return {type:'route', which:'custom', on};
  if (/\bsafe\b/.test(t) && !/\b(take|go|navigate)\b/.test(t)) return {type:'route', which:'safe', on};
  if (/\b(return|go back|back)\b.*\b(start|home|base)\b|^go home$|^return$/.test(t)) return {type:'goto', landmark:landmarks.find(l => l.id==='base')};
  if (/\b(map|plan|planning|overview)\b/.test(t) && !/\b(take|go|route|navigate)\b/.test(t)) return {type:'map'};
  const go = /\b(?:take me to|go to|navigate to|route to|walk to|head to|guide me to|direct me to)\b(.*)$/.exec(t);
  const found = findLandmark(go ? go[1] : t, landmarks);
  if (found.matches.length) return {type:'goto', landmark:found.matches[0]};
  if (go) return {type:'unknown', message:'No landmark called "'+go[1].trim()+'". Try: '+landmarks.map(l => l.name).join(', ')+'.'};
  return {type:'unknown', message:'Not understood. Try "take me to the slab", "show slope", "map" or "clear route".'};
}
