# This code was assisted through the use of SI.
"""Bake one observation-anchored sol using NASA/JPL SPICE. pip install spiceypy numpy."""
from pathlib import Path
import json, urllib.request, hashlib
import numpy as np
import spiceypy as spice

cache=Path('source/sky'); cache.mkdir(parents=True,exist_ok=True)
urls={
 'naif0012.tls':'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls',
 'pck00011.tpc':'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc',
 'de440s.bsp':'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp',
 'waypoints.json':'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json'}
for name,url in urls.items():
 p=cache/name
 if not p.exists(): urllib.request.urlretrieve(url,p)
 if name!='waypoints.json': spice.furnsh(str(p))
waypoints=json.loads((cache/'waypoints.json').read_text())
site=next(f['properties'] for f in waypoints['features'] if f['properties']['site']==26 and f['properties']['drive']==1004)
lat,lon=np.radians([site['lat'],site['lon']])
local=np.array([[np.sin(lon),-np.cos(lon),0],
 [np.cos(lat)*np.cos(lon),np.cos(lat)*np.sin(lon),np.sin(lat)],
 [-np.sin(lat)*np.cos(lon),-np.sin(lat)*np.sin(lon),np.cos(lat)]])
observer=local[1]*site['radius']/1000
utc='2022-06-23T22:55:32.782Z'
start=spice.str2et(utc); duration=88775.244; steps=720
samples=[]
for i in range(steps+1):
 et=start+duration*i/steps
 rotation=local@spice.pxform('J2000','IAU_MARS',et)
 sun,_=spice.spkpos('SUN',et,'J2000','LT+S','MARS BARYCENTER')
 sun=rotation@sun-local@observer; distance=float(np.linalg.norm(sun));sun/=distance
 assert np.max(np.abs(rotation@rotation.T-np.eye(3)))<1e-12
 samples.append({'seconds':duration*i/steps,'utc':spice.et2utc(et,'ISOC',3)+'Z',
  'icrfToLocal':rotation.flatten().tolist(),'sun':sun.tolist(),
  'sunAngularRadius':float(np.arcsin(695700/distance))})
result={'referenceUtc':utc,'referenceProduct':'NLF_0477_0709296508M723RAS_N0261004NCAM00708_0A00LLJ02',
 'site':{'latitude':site['lat'],'eastLongitude':site['lon'],'radiusMeters':site['radius'],'rmc':'26/1004','sol':477},
 'durationSeconds':duration,'samples':samples,
 'method':'SPICE IAU_MARS rotation; DE440s Sun relative to Mars barycenter, LT+S, topocentric observer subtraction; local west/up/north axes.',
 'starMap':{'url':'https://svs.gsfc.nasa.gov/4851/','projection':'ICRF/J2000 plate carree, RA 0 at center, increasing left',
  'credit':'NASA/Goddard Space Flight Center Scientific Visualization Studio; Ernie Wright; Hipparcos, Tycho-2, Gaia DR2'},
 'sources':[{ 'url':url,'sha256':hashlib.sha256((cache/name).read_bytes()).hexdigest()} for name,url in urls.items()],
 'limitations':['Geocentric J2000 stellar directions treated as distant ICRF directions; no stellar parallax/proper-motion correction.',
 'Single observation-anchored sol replay; atmospheric dust, exposure and terrain relighting are visual approximations, not measured radiometry.',
 'No planets, moons or artificial star positions are added.']}
Path('sky-data.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
print({'samples':len(samples),'site':result['site'],'sunElevationAtStart':float(np.degrees(np.arcsin(samples[0]['sun'][1])))})
