// Run with: node nav.test.mjs   (uses the real ground.bin)
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {makeGround} from './ground.mjs';
import {makeNav, makePriorGround, makeLandmarks, parseCommand, config} from './nav.mjs';

const meta = JSON.parse(readFileSync('terrain.json'));
const route = JSON.parse(readFileSync('route.json'));
const data = Uint8Array.from(readFileSync('ground.bin')).buffer;
const truth = makeGround(meta, data), prior = makePriorGround(meta, data);
const landmarks = makeLandmarks(route);
const results = [];
const test = (name, fn) => { try { const note = fn(); results.push('PASS  '+name+(note ? '  ['+note+']' : '')); }
  catch (error) { results.push('FAIL  '+name+'  '+error.message); process.exitCode = 1; } };

// The same movement rule as viewer.mjs: 2.5 cm steps, footing required, 15 cm step limit.
function walk(ground, dense) {
  let [x,y,z] = dense[0]; y = ground.foot(x,z);
  for (let i=1; i<dense.length; i++) {
    const [tx,,tz] = dense[i], length = Math.hypot(tx-x,tz-z), steps = Math.max(1,Math.ceil(length/0.025));
    const sx = (tx-x)/steps, sz = (tz-z)/steps;
    for (let s=0; s<steps; s++) {
      const ny = ground.foot(x+sx, z+sz);
      if (!Number.isFinite(ny)) return 'no footing at '+(x+sx).toFixed(2)+','+(z+sz).toFixed(2);
      if (Math.abs(ny-y)>=0.15) return 'step too high at '+(x+sx).toFixed(2)+','+(z+sz).toFixed(2);
      x += sx; z += sz; y = ny;
    }
  }
  return null;
}
const spawn = [route.spawn.x, route.spawn.z];
const far = [route.expansion.end.x, route.expansion.end.z];

test('truth route from start to the far corner exists and every segment is clear', () => {
  const nav = makeNav(meta, truth, null), r = nav.plan(spawn, far);
  assert.ok(r.points, r.error);
  assert.equal(nav.firstBlock(r.dense), null);
  return r.distance.toFixed(1)+' m, '+r.time.toFixed(0)+' s, max slope '+r.maxSlope.toFixed(0)+' deg; '+r.reason;
});
test('a scripted walker using the viewer movement rule completes that route', () => {
  const nav = makeNav(meta, truth, null), r = nav.plan(spawn, far);
  assert.equal(walk(truth, r.dense), null);
});
test('routes to every landmark are walkable end to end', () => {
  const nav = makeNav(meta, truth, null);
  return landmarks.map(l => { const r = nav.plan(spawn, (l.viewing ?? [l.position])[0]);
    assert.ok(r.points, l.name+': '+r.error); assert.equal(walk(truth, r.dense), null, l.name);
    return l.id+' '+r.distance.toFixed(1)+'m'; }).join(', ');
});
test('a detour names a real blocker and is longer than the straight line', () => {
  const nav = makeNav(meta, truth, null);
  const found = nav.plan(spawn, landmarks.find(l => l.id==='bench').position);
  assert.ok(found.points, found.error);
  assert.match(found.reason, /Detours/);
  assert.ok(found.distance>found.straight+1);
  assert.equal(walk(truth, found.dense), null);
  return found.distance.toFixed(1)+' m vs '+found.straight.toFixed(1)+' m straight. '+found.reason;
});
test('the prior misses hazards: scanning forces a re-route that is then clear on the truth', () => {
  const goal = landmarks.find(l => l.id==='bench').position;
  const nav = makeNav(meta, truth, prior), first = nav.plan(spawn, goal);
  assert.ok(first.points, first.error);
  assert.ok(first.usesPrior);
  nav.scanAll();
  const block = nav.firstBlock(first.dense);
  assert.ok(block, 'the prior route was not blocked on the real surface');
  const second = nav.plan(spawn, goal);
  assert.ok(second.points, second.error);
  assert.equal(nav.firstBlock(second.dense), null);
  assert.equal(walk(truth, second.dense), null);
  return 'prior route '+first.distance.toFixed(1)+' m is blocked by '+block.what+'; re-route '+second.distance.toFixed(1)+' m';
});
test('a blocked landmark is not walkable itself but its viewing points are', () => {
  const o = landmarks.find(l => l.id==='outcrop');
  assert.ok(!Number.isFinite(truth.foot(...o.position)), 'outcrop position is walkable');
  for (const v of o.viewing) assert.ok(Number.isFinite(truth.foot(...v)), 'viewing point '+v+' not walkable');
});
test('scanner reveals ground near the walker and not the whole patch', () => {
  const nav = makeNav(meta, truth, prior);
  const fresh = nav.scan(spawn[0], spawn[1], truth.foot(...spawn)+1.65);
  const share = fresh/(nav.cols*nav.rows);
  assert.ok(fresh>500 && share<0.5);
  return fresh+' cells, '+(share*100).toFixed(0)+'% of the patch';
});
test('a destination on blocked ground reports no route or snaps to walkable ground nearby', () => {
  const nav = makeNav(meta, truth, null), r = nav.plan(spawn, [-5,-5]);
  assert.ok(r.error);
  return r.error;
});
test('commands: goto, fuzzy name, layers, clear, unknown', () => {
  assert.equal(parseCommand('Take me to the slab please', landmarks).landmark.id, 'slab');
  assert.equal(parseCommand('uh go to the layerd slab', landmarks).landmark.id, 'slab');
  assert.equal(parseCommand('return to start', landmarks).landmark.id, 'start');
  assert.deepEqual(parseCommand('show hazards', landmarks), {type:'layer', layer:'hazard', on:true});
  assert.deepEqual(parseCommand('hide slopes', landmarks), {type:'layer', layer:'slope', on:false});
  assert.equal(parseCommand('show ground truth', landmarks).layer, 'truth');
  assert.equal(parseCommand('clear route', landmarks).type, 'clear');
  assert.equal(parseCommand('open the map', landmarks).type, 'map');
  assert.equal(parseCommand('take me to olympus mons', landmarks).type, 'unknown');
});
console.log(results.join('\n'));
