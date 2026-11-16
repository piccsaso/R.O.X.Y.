// This code was assisted through the use of SI.
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const read = async name => JSON.parse(await readFile(`weather-data/${name}.json`, 'utf8'));
// Retrospective surrogate of ENLIL predictions, not a validation against observations.
function samples(events) {
  const rows = [];
  for (const event of events) {
    const candidates = [];
    for (const analysis of event.cmeAnalyses || []) {
      if (!(analysis.speed > 0) || !Number.isFinite(analysis.halfAngle)) continue;
      for (const simulation of analysis.enlilList || []) {
        // Compound eruptions cannot be assigned an independent travel-time label.
        if (simulation.cmeIDs?.length !== 1) continue;
        const impact = simulation.impactList?.find(item => item.location === 'Mars');
        const hours = (Date.parse(impact?.arrivalTime) - Date.parse(analysis.time21_5)) / 3600000;
        if (!(hours > 0 && hours < 500)) continue;
        candidates.push({id:event.activityID, start:event.startTime, speed:analysis.speed,
          halfAngle:analysis.halfAngle, hours, arrival:impact.arrivalTime,
          boundaryTime:analysis.time21_5, completion:simulation.modelCompletionTime,
          link:simulation.link, eventLink:event.link, glancing:impact.isGlancingBlow});
      }
    }
    candidates.sort((a,b) => a.completion.localeCompare(b.completion));
    if (candidates.length) rows.push(candidates[0]);
  }
  return rows.sort((a,b) => a.start.localeCompare(b.start));
}
const AU = 149597870.7, SOLAR_RADIUS = 695700;
export function ballisticHours(speed) { return (1.52 * AU - 21.5 * SOLAR_RADIUS) / speed / 3600; }
const features = row => [1, ballisticHours(row.speed) / 100, row.halfAngle / 90];
function solve(matrix, vector) {
  const rows = matrix.map((row,i) => [...row,vector[i]]);
  for (let col=0; col<vector.length; col++) {
    let pivot=col;
    for (let row=col+1; row<vector.length; row++) if(Math.abs(rows[row][col])>Math.abs(rows[pivot][col])) pivot=row;
    [rows[col],rows[pivot]]=[rows[pivot],rows[col]];
    const scale=rows[col][col];
    if(Math.abs(scale)<1e-10) throw new Error('Singular training matrix');
    for(let j=col;j<=vector.length;j++) rows[col][j]/=scale;
    for(let row=0;row<vector.length;row++) if(row!==col) {
      const factor=rows[row][col];
      for(let j=col;j<=vector.length;j++) rows[row][j]-=factor*rows[col][j];
    }
  }
  return rows.map(row=>row.at(-1));
}
const trainingFiles=['CME-2024-01-01','CME-2024-02-01','CME-2024-03-01'];
const train=samples((await Promise.all(trainingFiles.map(read))).flat());
const test=samples(await read('CME'));
if(train.length<10 || test.length<5) throw new Error('Insufficient Mars labels for a train/test report');
const matrix=Array.from({length:3},()=>[0,0,0]), vector=[0,0,0];
for(const row of train) {
  const x=features(row), residual=row.hours-ballisticHours(row.speed);
  for(let i=0;i<3;i++) { vector[i]+=x[i]*residual; for(let j=0;j<3;j++) matrix[i][j]+=x[i]*x[j]; }
}
matrix[1][1]+=1; matrix[2][2]+=1;
const coefficients=solve(matrix,vector);
const predict=row=>Math.max(1,Math.min(500,ballisticHours(row.speed)+features(row).reduce((sum,x,i)=>sum+x*coefficients[i],0)));
const rmse=fn=>Math.sqrt(test.reduce((sum,row)=>sum+(fn(row)-row.hours)**2,0)/test.length);
const model={type:'Ridge regression residual on constant-speed propagation', coefficients,
  trainCount:train.length,testCount:test.length,trainWindow:'2024-01-01 / 2024-03-31',testWindow:'2024-05-01 / 2024-05-31',
  target:'Hours from 21.5 solar radii to the published ENLIL Mars arrival prediction',
  surrogateRmseHours:rmse(predict),ballisticRmseHours:rmse(row=>ballisticHours(row.speed)),
  limitations:'Retrospective revised catalog. One earliest available single-CME Mars simulation per event. April gap. Fixed 1.52 AU. Conditional on a published Mars impact. No observed-arrival validation or solar-cycle validation.'};
const sep=await read('SEP'),gst=await read('GST'),flares=await read('FLR');
const manifest=[];
for(const file of [...trainingFiles,'CME','SEP','GST','FLR']) {
  const bytes=await readFile(`weather-data/${file}.json`);
  manifest.push({file:`${file}.json`,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const summary={retrieved:'2026-11-15',window:'May 2024 historical catalog',model,manifest,
  cmes:test.map(row=>({...row,surrogateHours:predict(row)})),
  sep:sep.map(row=>{
    const strength=value=>{const m=/^([ABCMX])([\d.]+)$/.exec(value||'');return m ? 10**('ABCMX'.indexOf(m[1]))*Number(m[2]) : 0;};
    const linked=flares.filter(flare=>row.linkedEvents?.some(event=>event.activityID===flare.flrID)).sort((a,b)=>strength(b.classType)-strength(a.classType))[0];
    return {id:row.sepID,time:row.eventTime,instruments:row.instruments.map(i=>i.displayName),link:row.link,linkedFlareClass:linked?.classType??null,linkedFlareId:linked?.flrID??null};
  }),
  gst:gst.map(row=>({id:row.gstID,time:row.startTime,kp:Math.max(...row.allKpIndex.map(i=>i.kpIndex)),link:row.link})),
  flares:flares.map(row=>({id:row.flrID,time:row.peakTime,class:row.classType,link:row.link}))};
await writeFile('weather-data/summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(model,null,2));
