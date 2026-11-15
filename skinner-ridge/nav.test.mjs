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
  for (const phrase of ['open the overlay tab','show overlays','bring up the overlays panel']) assert.deepEqual(parseCommand(phrase, landmarks), {type:'menu',menu:'layers'});
  for (const phrase of ['go to trafficability','switch to trafficability','take me to trafficability']) assert.deepEqual(parseCommand(phrase, landmarks), {type:'layer',layer:'traffic',on:true});
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
console.log(results.join('\n'));
