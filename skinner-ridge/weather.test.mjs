// This code was assisted through the use of SI.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {severeRecords,flareMagnitude} from './weather.mjs';
const data=JSON.parse(readFileSync(new URL('./weather-data/summary.json',import.meta.url)));
assert.ok(flareMagnitude('X1')>flareMagnitude('M9.9'));
for(const key of ['flare','cme','sep','gst']) {
  const rows=severeRecords(data,key);
  assert.equal(rows.length,5);
  const score=r=>key==='cme'?r.speed:key==='gst'?r.kp:flareMagnitude(key==='sep'?r.linkedFlareClass:r.class);
  for(let i=1;i<rows.length;i++)assert.ok(score(rows[i-1])>=score(rows[i]));
}
const original=data.flares.map(r=>r.id);
severeRecords(data,'flare');assert.deepEqual(data.flares.map(r=>r.id),original);
assert.equal(severeRecords({flares:[]},'flare').length,0);
console.log('Weather top-five rankings, proxy metadata and archive preservation passed');
