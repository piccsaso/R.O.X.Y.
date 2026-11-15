// Run with: node nav.test.mjs   (uses the real ground.bin and the same context apron as the viewer)
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {makeGround} from './ground.mjs';
import {buildApron} from './apron.mjs';
import {makeNav, makeLandmarks, parseCommand} from './nav.mjs';

const meta = JSON.parse(readFileSync('terrain.json'));
const route = JSON.parse(readFileSync('route.json'));
const core = makeGround(meta, Uint8Array.from(readFileSync('ground.bin')).buffer);
const apron = buildApron(core, meta);
const ground = {sample:(x,z) => core.sample(x,z) || apron.sample(x,z)};
const t0 = Date.now(), nav = makeNav(meta, ground), built = Date.now()-t0;
const landmarks = makeLandmarks(route);
const base = landmarks.find(l => l.id==='base').position, summit = landmarks.find(l => l.id==='summit').position;
const results = [];
const test = (name, fn) => { try { const note = fn(); results.push('PASS  '+name+(note ? '  ['+note+']' : '')); }
  catch (error) { results.push('FAIL  '+name+'  '+error.message); process.exitCode = 1; } };

test('every landmark is on the routing grid and has ground under it', () => {
  for (const l of landmarks) assert.ok(ground.sample(...l.position) && nav.index(...l.position)>=0, l.name);
  return 'grid '+nav.cols+'x'+nav.rows+' built in '+built+' ms; summit height '+ground.sample(...summit).height.toFixed(1)+' m, base '+ground.sample(...base).height.toFixed(1)+' m';
});
test('safe route from Home Base to the summit exists and crosses less unsafe footing than the straight line', () => {
  const t = Date.now(), s = nav.safe(base, summit), d = nav.straight(base, summit);
  assert.ok(s, 'no safe route');
  assert.ok(s.unsafeDistance<d.unsafeDistance, 'safe '+s.unsafeDistance+' vs straight '+d.unsafeDistance);
  assert.ok(s.distance>=d.distance-0.5);
  return 'straight '+d.distance.toFixed(1)+' m with '+d.unsafeDistance.toFixed(1)+' m unsafe; safe '+s.distance.toFixed(1)+' m with '+
    s.unsafeDistance.toFixed(1)+' m unsafe, '+s.time.toFixed(0)+' s, climb '+s.gain.toFixed(1)+' m; planned in '+(Date.now()-t)+' ms';
});
test('safe route is continuous and stays on ground', () => {
  const s = nav.safe(base, summit);
  for (let i=1; i<s.dense.length; i++) {
    assert.ok(Math.hypot(s.dense[i][0]-s.dense[i-1][0], s.dense[i][2]-s.dense[i-1][2])<0.45, 'gap at '+i);
    assert.ok(ground.sample(s.dense[i][0], s.dense[i][2]), 'no ground at '+i);
  }
});
test('routes exist between all landmarks, both ways', () => {
  for (const a of landmarks) for (const b of landmarks) if (a!==b) assert.ok(nav.safe(a.position, b.position), a.name+' to '+b.name);
});
test('commands', () => {
  assert.equal(parseCommand('Take me to the summit please', landmarks).landmark.id, 'summit');
  assert.equal(parseCommand('go to the layerd slab', landmarks).landmark.id, 'slab');
  assert.equal(parseCommand('return to base', landmarks).landmark.id, 'base');
  assert.deepEqual(parseCommand('show slope', landmarks), {type:'layer', layer:'slope', on:true});
  assert.deepEqual(parseCommand('hide ground truth', landmarks), {type:'layer', layer:'truth', on:false});
  assert.deepEqual(parseCommand('safe route', landmarks), {type:'route', which:'safe', on:'toggle'});
  assert.deepEqual(parseCommand('slope', landmarks), {type:'layer', layer:'slope', on:'toggle'});
  assert.equal(parseCommand('close', landmarks).type, 'close');
  assert.equal(parseCommand('map', landmarks).type, 'map');
  assert.equal(parseCommand('reset position', landmarks).type, 'reset');
  assert.equal(parseCommand('voice route', landmarks).which, 'custom');
  assert.equal(parseCommand('show the straight line', landmarks).which, 'straight');
  assert.equal(parseCommand('clear route', landmarks).type, 'clear');
  assert.equal(parseCommand('open the map', landmarks).type, 'map');
  assert.equal(parseCommand('take me to olympus mons', landmarks).type, 'unknown');
});
test('cost breakdown reports every layer, and missing layers are left out, not guessed', () => {
  const s = nav.safe(base, summit), b = s.breakdown;
  assert.ok(b.layers.slope.hasData && b.layers.topography.hasData);
  assert.equal(b.layers.weather.hasData, false);
  assert.equal(b.layers.thermal.hasData, false);
  assert.equal(b.impassableMetres, 0);
  assert.ok(Math.abs(b.layers.slope.costSeconds+b.layers.topography.costSeconds-b.hazardCostSeconds)<0.5);
  return nav.explain(s, nav.straight(base, summit));
});
test('hard constraint: a severe weather cell across the safe route is never entered', () => {
  const before = nav.safe(base, summit), mid = before.dense[Math.floor(before.dense.length/2)];
  const info = nav.setOverlay('weather', {sample:(x,z) => Math.hypot(x-mid[0], z-mid[2])<4 ? 1 : 0.05});
  const after = nav.safe(base, summit);
  assert.ok(info.cellsWithData===nav.count);
  assert.ok(after && !after.forced);
  assert.equal(after.breakdown.impassableMetres, 0);
  for (const [x,,z] of after.dense) assert.ok(Math.hypot(x-mid[0], z-mid[2])>=3.7, 'route enters the cell');
  assert.ok(after.distance>before.distance);
  nav.setOverlay('weather', null);
  return 'route grew from '+before.distance.toFixed(1)+' m to '+after.distance.toFixed(1)+' m to go around a 4 m cell';
});
test('soft cost: a thermal gradient shifts the route and shows in the breakdown', () => {
  const before = nav.safe(base, summit);
  nav.setOverlay('thermal', {sample:(x,z) => Math.max(0, Math.min(0.8, (30-x)/20+0.4))});   // warmer risk toward the east
  const after = nav.safe(base, summit);
  assert.ok(after.breakdown.layers.thermal.hasData);
  assert.ok(after.breakdown.layers.thermal.costSeconds>0);
  nav.setOverlay('thermal', null);
  const again = nav.safe(base, summit);
  assert.ok(Math.abs(again.distance-before.distance)<0.01, 'removing the layer did not restore the route');
  return 'thermal mean risk '+after.breakdown.layers.thermal.meanRisk.toFixed(2)+', cost '+after.breakdown.layers.thermal.costSeconds.toFixed(0)+' s';
});
test('misaligned or broken overlays are ignored without failing', () => {
  const away = nav.setOverlay('weather', {x0:5000, z0:5000, cell:1, cols:4, rows:4, values:new Array(16).fill(1), min:0, max:1});
  assert.equal(away.cellsWithData, 0);
  const broken = nav.setOverlay('thermal', {sample:() => { throw new Error('bad layer'); }});
  assert.equal(broken.cellsWithData, 0);
  const partial = nav.setOverlay('weather', {x0:20, z0:10, cell:2, cols:6, rows:6, values:Array.from({length:36}, (_,i) => i%5 ? 0.3 : null), min:0, max:1});
  assert.ok(partial.cellsWithData>0 && partial.coverage<0.05);
  assert.ok(nav.safe(base, summit));
  nav.setOverlay('weather', null); nav.setOverlay('thermal', null);
  return 'off-map grid gave '+away.cellsWithData+' cells, throwing layer gave '+broken.cellsWithData+', partial grid covered '+(partial.coverage*100).toFixed(1)+'%';
});
test('if hard constraints wall off the goal, the route is flagged as forced', () => {
  nav.setOverlay('weather', {sample:(x,z) => Math.hypot(x-summit[0], z-summit[1])<6 && Math.hypot(x-summit[0], z-summit[1])>2 ? 1 : 0});
  const r = nav.safe(base, summit);
  nav.setOverlay('weather', null);
  assert.ok(r && r.forced && r.breakdown.impassableMetres>0);
  return nav.explain(r).split(' · ').pop();
});
console.log(results.join('\n'));
