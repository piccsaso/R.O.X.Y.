# Mars sky: data, coordinates, and limits

## Observation and location

The replay begins at **2022-06-23T22:55:32.782Z**, the start time in the archived label for `NLF_0477_0709296508M723RAS_N0261004NCAM00708_0A00LLJ02`, sol 477. The NASA [rover waypoint file](https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json) identifies site 26/drive 1004 at planetocentric latitude 18.45889532°, east longitude 77.40616768°, radius 3,391,983.897 m. A single site orientation is adequate over this small footprint; the sky does not change appreciably while walking tens of metres.

## Sun and orientation

`build-sky.py` uses NASA/JPL NAIF SPICE with [DE440s](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp), [PCK00011](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc), and [NAIF0012 leap seconds](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls). Download hashes are recorded in `sky-data.json`.

For 721 samples spanning 88,775.244 seconds, the script transforms J2000 into IAU_MARS and then a local west/up/north basis. It obtains the Sun relative to the Mars barycenter in J2000 with light-time and stellar-aberration correction, rotates it at observer time, and subtracts the site radius vector. The barycenter approximation avoids needing a separate Mars-satellite ephemeris. Solar angular radius uses a 695,700 km nominal radius and the computed distance.

The runtime interpolates adjacent samples and normalizes direction vectors. Matrix orthogonality and Sun-vector lengths are checked by `verify-assets.mjs`. This is a representative-sol replay, not a continuously advancing multi-year ephemeris: the loop resets to the original observation. Clock labels use the sampled UTC, not Earth local time or a claim of exact rover local solar time.

## Stars

NASA SVS [Deep Star Maps 2020](https://svs.gsfc.nasa.gov/4851/) provides the actual catalog-based celestial map. It combines Hipparcos-2, Tycho-2, Gaia DR2, and supplementary catalogs. The downloaded 4K EXR uses ICRF/J2000 right ascension and declination: RA zero at the image center, increasing leftward.

The source is converted to a display PNG without changing star coordinates. EXRLoader emits bottom-up rows, preserved in the PNG and loaded with `flipY=false`. The viewer converts the texture to a cubemap once, then transforms each local view ray into ICRF before sampling. The equivalent source UV is `u = 0.5 − RA/(2π)`, `v = 0.5 + Dec/π`. Texture-coordinate spot checks locate Sirius and Vega at their expected source-map positions. Stars below the geometric horizon and low-elevation stars are suppressed by an approximate extinction model. Terrain naturally occludes the sky.

The map is a catalog visualization, not a simulated naked-eye limiting-magnitude measurement. Star colors and the Milky Way use an artistic display exposure. Individual stellar proper motion and parallax are not propagated from the catalog epoch to the replay date; geocentric J2000 directions are treated as distant ICRF directions. No invented constellations, planets, moons, or auroras are added.

## Atmosphere and terrain lighting

NASA's [Mars sunrise and sunset explanation](https://science.nasa.gov/solar-system/planets/mars/what-does-a-sunrise-sunset-look-like-on-mars/) and [Gale sunset imagery](https://science.nasa.gov/resource/sunset-at-mars-gale-crater-curiosity/) guide the warm dusty daytime sky and blue forward-scattering region near the low Sun.

The renderer is an approximate visual model. Dust optical depth, exposure, haze, night visibility, and terrain reflectance are not calibrated to that observation. It does not simulate full radiative transfer. Ground photos retain their baked solar shadows; runtime illumination modulates their appearance but does not reconstruct physically exact dynamic cast shadows. The exploration light is a user aid, not a natural Martian source. A darker ground and restrained sky exposure were selected to support the user's natural-night preference.

Credits: NASA/JPL-Caltech for ephemeris and rover sources; NASA/Goddard Space Flight Center Scientific Visualization Studio and Ernie Wright for the star-map visualization; the contributing catalog teams listed by NASA SVS.
