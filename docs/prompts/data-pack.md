# Data pack: orbital context and science facts for Skinner Ridge

Time box: 3 hours. Deliver whatever is finished at the time box; each item below is useful on its own.

## Context

We are building a NASA Space Apps 2026 entry: a helmet HUD rehearsed in first person on real Mars terrain. The app is in `skinner-ridge/` of the repository `piccsaso/nasa-hackathon` and already works. It shows a 28 × 24.5 m patch of Perseverance's Skinner Ridge workspace (Hawksbill Gap, Jezero crater), built from NASA Navcam mesh products in SITE_FRAME 26. Read `skinner-ridge/README.md` and `skinner-ridge/SITE_SELECTION.md` first.

Everything in the app comes from one mission, Perseverance. The challenge asks for data from several NASA missions. Your job is to fetch and prepare a small set of files from other missions, plus verified facts, so the app can show them. You write no app code and you do not edit anything already in `skinner-ridge/`.

## Coordinate frame you must deliver in

The app's local frame: metres, +X west, +Y up, +Z north. The origin is the patch's south-east corner, which is (77.49 m north, 2.51 m east, −14 m down) in SITE_FRAME 26. The patch covers X from 0 to 28 and Z from 0 to 24.5.

To place orbital data you need the map position of the SITE 26 origin. Get it from the rover waypoint data (`https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json`) and the PDS labels listed in `skinner-ridge/terrain.json`. Then check it by eye: rock edges in the patch (see `skinner-ridge/screenshots/survey.png`, north is up, east is right) should line up with the same features in the orbital image. Report the remaining offset in metres. This number matters more than anything else you deliver.

## Deliverables, in priority order

Put everything in a new directory `skinner-ridge/context/`.

1. **`facts.json`: verified science facts for the stop.** What Perseverance did at Skinner Ridge: abrasion patch name, sample core names, sols, instruments used, and what the rock is (delta-front sedimentary rock). For each fact give the source URL and quote the sentence that supports it. Include one NASA image of the workspace (file saved as `workspace.jpg`, at most 1600 px wide) with image ID, credit and source URL. Do not include anything you could not find in a NASA, JPL or peer-reviewed source. The slab in our patch has no verified individual name; do not assign one.

2. **`hirise.png` and `hirise.json`: orbital image around the patch.** A crop of the HiRISE orthoimage (Mars Reconnaissance Orbiter; USGS Jezero landing-site products) about 600 m across, centred on the patch, north up. The JSON gives: bounds in local metres (`xWest`, `xEast`, `zSouth`, `zNorth`), metres per pixel, product ID, credit, licence, source URL, and the registration offset you measured.

3. **`hirise-dtm.bin` and `hirise-dtm.json`: orbital elevation for the same area.** Float32 heights, row-major from south to north, in metres in the local frame's Y (so the values agree with the patch where they overlap; report the mean and spread of the difference over the patch). The JSON gives width, height, post spacing and bounds as above. This replaces the simulated prior map in the app with the real orbital surface.

4. **`thermal.png` and `thermal.json`: a thermal layer from Mars Odyssey THEMIS**, over a 3 km area centred on the patch, same JSON fields plus units and value range. If THEMIS takes more than 45 minutes, deliver the geologic units from USGS SIM 3464 instead as `geology.png` with a legend (colour, published unit name) and a note that it was mapped at 1:75,000.

5. **`SOURCES.md`**: every product with URL (tested), licence, credit line, native resolution and how you verified it.

## Rules

- Label each claim in your report VERIFIED (you opened the file and say what you checked), INFERRED, or UNKNOWN.
- Never place or name a feature from a guess. An item you could not verify is left out and listed as missing.
- Commit scripts that fetch and process the data, so the files can be rebuilt. Do not commit raw downloads larger than a few megabytes; commit the processed PNG, JSON and BIN files.
- Work on a branch `data/context-pack` and open a pull request to `main`. Touch only `skinner-ridge/context/`.
- Everything must run on Windows with free tools.

## Report back

What you delivered, the registration offset and how you measured it, what you could not get and why.
