import assert from 'node:assert/strict';
import {slopeDegrees,overlayPixel,elevationRange,overlayLayers} from './overlays.mjs';
import {parseCommand} from './nav.mjs';
const flat={sample:()=>({height:3})};
assert.equal(slopeDegrees(flat,0,0),0);
assert.ok(Math.abs(slopeDegrees({sample:(x)=>({height:x})},0,0)-45)<1e-9);
assert.ok(Number.isNaN(slopeDegrees({sample:()=>undefined},0,0)));
const base={x:1,z:1,height:2,slope:0,unsafe:0,support:0,range:[0,4]};
assert.deepEqual(overlayPixel('traffic',base),[69,188,120,175]);
assert.deepEqual(overlayPixel('traffic',{...base,slope:25}),[239,85,85,220]);
assert.deepEqual(overlayPixel('traffic',{...base,unsafe:1}),[239,85,85,220]);
assert.deepEqual(overlayPixel('traffic',{...base,support:1}),[146,152,166,160]);
assert.equal(overlayPixel('topo',{...base,support:1})[3],0);
assert.equal(overlayPixel('topo',{...base,height:NaN})[3],0);
assert.deepEqual(elevationRange({count:3,height:[-2,3,100],center:i=>[i,0]},x=>x===2?1:0),[-2,3]);
for(const key of ['minerals','thermal']) {
  assert.equal(overlayPixel(key,base)[3],0,'Orbital context must not fabricate local variation');
  const layer=overlayLayers[key],span=180/2**layer.zoom;
  assert.equal(Math.floor((77.40616768+180)/span),layer.col);
  assert.equal(Math.floor((90-18.45889532)/span),layer.row);
}
for(const [text,key] of [['show hazards','traffic'],['show minerals','minerals'],['show thermal','thermal'],['show topography','topo']]) assert.equal(parseCommand(text).layer,key);
console.log('Overlay slope, coverage, thresholds, tile placement and command checks passed');
const voiceKeywords = {
  topo: ['topography', 'topographic', 'topo', 'elevation'],
  traffic: ['trafficability', 'traffic', 'traversability', 'hazards'],
  minerals: ['minerals', 'mineral', 'resources'],
  thermal: ['thermal', 'thermals', 'regolith', 'infrared']
};
for (const [layer, keywords] of Object.entries(voiceKeywords)) {
  for (const keyword of keywords) {
    for (const phrase of [`show ${keyword}`, `open ${keyword}`, `make ${keyword} visible`]) {
      assert.deepEqual(parseCommand(phrase, []), {type:'layer', layer, on:true});
    }
    for (const phrase of [`hide ${keyword}`, `turn ${keyword} off`, `make ${keyword} invisible`]) {
      assert.deepEqual(parseCommand(phrase, []), {type:'layer', layer, on:false});
    }
    assert.deepEqual(parseCommand(keyword, []), {type:'layer', layer, on:'toggle'});
  }
}
console.log('Roxy overlay keyword and visibility command checks passed');
