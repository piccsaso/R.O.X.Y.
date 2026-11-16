// This code was generated through the use of SI.
// Local terrain derivatives and native-colour regional NASA Trek observations.
export const overlayLayers = {
  traffic: {name:'Trafficability & hazards', status:'Terrain-derived · prototype thresholds', colors:[['#45bc78','Lower slope'],['#f1ce52','Caution'],['#ef5555','Steep / uneven'],['#9298a6','Unknown']], note:'Green <15°; yellow 15–25°; red ≥25° or footing step >0.17 m. Gray = unverified support; missing heights are uncoloured. Not an EVA safety assessment.'},
  minerals: {name:'Minerals & resources', status:'TES clinopyroxene · regional context tint', colors:[], regional:false, image:'observations/minerals.png', zoom:1, row:0, col:2, source:'TES_Clinopyroxene', note:'Native TES pixel sampled at the rover reference location and shown as a uniform context tint on verified terrain. Not a local mineral map or abundance measurement. No clay, carbonate, sulfate or ice extraction claims.'},
  thermal: {name:'Thermal & regolith', status:'NASA Trek · THEMIS night IR · regional context', colors:[], regional:true, image:'observations/thermal.png', zoom:9, row:203, col:732, source:'THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018', note:'Original nighttime infrared mosaic, not calibrated temperature. Tile pixels span about 81 m north–south, coarser than this terrain patch. Does not classify regolith or track the sky clock. Marker indicates the nearby rover reference location.'},
  topo: {name:'Topography & elevation', status:'Terrain-derived · observed support only', colors:[['#5067c9','Low'],['#49cbb8','Mid'],['#f4d364','High'],['#eea5ce','Highest']], note:'Height relative to the supported model minimum; 1 m contours. Inferred and context terrain are uncoloured. Local model coordinates, not MOLA altitude.'}
};
const ramp = (t, stops) => {
  const v=Math.max(0,Math.min(1,t))*(stops.length-1), i=Math.min(stops.length-2,Math.floor(v));
  return stops[i].map((c,k)=>Math.round(c+(stops[i+1][k]-c)*(v-i)));
};
export function slopeDegrees(ground,x,z) {
  const samples=[[x-.4,z],[x+.4,z],[x,z-.4],[x,z+.4]].map(p=>ground.sample(...p)?.height);
  if (!samples.every(Number.isFinite)) return NaN;
  return Math.atan(Math.hypot(samples[1]-samples[0],samples[3]-samples[2])/.8)*180/Math.PI;
}
export function elevationRange(nav, support) {
  let min=Infinity,max=-Infinity;
  for(let i=0;i<nav.count;i++) if(support(...nav.center(i))===0 && Number.isFinite(nav.height[i])) {
    min=Math.min(min,nav.height[i]); max=Math.max(max,nav.height[i]);
  }
  return Number.isFinite(min) ? [min,max] : [0,0];
}
export function overlayPixel(layer,{x,z,height,slope,unsafe,support,range}) {
  if (!Number.isFinite(height)) return [0,0,0,0];
  if(layer==='traffic') {
    if(support!==0 || !Number.isFinite(slope) || unsafe===2) return [146,152,166,160];
    return slope>=25 || unsafe===1 ? [239,85,85,220] : slope>=15 ? [241,206,82,200] : [69,188,120,175];
  }
  if(support!==0) return [0,0,0,0];
  if(layer==='topo') {
    const rel=height-range[0], t=rel/Math.max(.001,range[1]-range[0]);
    const rgb=ramp(t,[[80,103,201],[73,203,184],[244,211,100],[238,165,206]]);
    const contour=Math.abs(rel-Math.round(rel))<.055;
    return [...(contour ? rgb.map(c=>Math.round(c*.45)) : rgb),205];
  }
  return [0,0,0,0];
}
