# Mars weather simulation

Open the circular Roxy launcher, then choose **Weather** in the rounded control strip. Expand the subsection for dust storms, solar flares, CMEs, solar energetic particles or Earth geomagnetic storms, then activate a scenario. The menu closes after activation. Each solar subsection includes its own historical-record selector. **Clear all weather** restores clear conditions and underlying trafficability colors. Persistent HUD warnings distinguish simulated EVA danger, exposure assessment cautions and Earth-context alerts. No source records measure astronaut suit damage or certify shielding at Jezero. Controls use local files, so the demo works offline after dependencies are installed.

## Visible effects and hazard interpretation

- Dust adds 1,600 recycled Three.js particles, decreases viewing distance and dims terrain lighting. The medium/severe controls are authored visual intensities. NASA reported optical depth 10.8 at Opportunity during the 2018 global dust storm. This observation motivates the scenario but does not calibrate its visibility distances or specify Jezero weather. Dust direction is illustrative.
- Solar energetic particles activate simulated camera specks and a magenta trafficability advisory. The historical inspiration is the May 20, 2024 event documented at Curiosity in Gale. The effect represents detector interference. No radiation dose, particle flux or shelter shielding is calculated at Jezero.
- CME warnings display a Mars-targeted ENLIL arrival prediction. The generated model artifact retains experimental ML surrogate results for evaluation. The record does not automatically establish a surface radiation event.
- Geomagnetic storm records show Earth Kp values. They produce an Earth-context notice without modifying Mars hazards. Mars lacks an internally generated global magnetic field.
- Solar flares display the catalog class and time. No surface dose is inferred.

Trafficability retains its original terrain-support mask. Dust promotes supported green cells to yellow visibility caution. A particle scenario colors supported cells magenta for an area-wide training advisory while retaining red steep/uneven cells. The particle advisory still applies to red cells. Inferred and unknown terrain retains its unknown status. Slope, collision and navigation costs remain terrain-based. The routes are not radiation-aware or weather-validated safe routes. A weather scenario does not establish that a visible rock provides shelter.

The existing NASA Trek THEMIS night-IR and TES mineral observation maps remain available in Overlays. They are regional/static products. Existing Navcam terrain and coverage support the local hazard display. No regional tile is treated as live dust, wind or radiation telemetry. The scene retains its sol-477 sky reference, while selected storm records have their own historical dates.

## Experimental hybrid model

DONKI is NASA's event database. This repository trains its own small ridge-regression surrogate using DONKI's published ENLIL Mars-impact predictions. The model is not an official NASA ML product.

Run `node build-weather.mjs` from this directory to reproduce `weather-data/summary.json`. Training uses January–March 2024. April is a gap. May 2024 is held out. Each CME contributes at most one row, from its earliest available single-CME ENLIL run with an explicit `impactList.location === "Mars"`. Compound CME runs are excluded. The target is elapsed time from the analysis's 21.5-solar-radius boundary time to its published Mars arrival.

The physical baseline is constant-speed radial propagation from 21.5 solar radii to a fixed 1.52 AU distance. Ridge regression fits its residual using intercept, scaled baseline time and half-angle, with regularization 1 on the two non-intercept coefficients. This is a conditional travel-time surrogate for cataloged Mars impacts, not an impact-probability classifier. It does not model orbital geometry, solar-wind drag, radiation transport, dust formation or magnetic connectivity.

The generated report records 24 training and 16 test cases. Test RMSE against ENLIL predictions is 11.805 hours for the surrogate and 23.095 hours for the constant-speed baseline. The full downloaded catalog contains revised analyses, so this is a retrospective experiment rather than a reconstruction of information available in real time. Observed-arrival validation, uncertainty calibration, OMNI pairing and cross-solar-cycle testing remain outstanding. No performance advantage over full MHD computation has been measured.

## Source provenance

Downloaded 2026-11-15 from `https://ccmc.gsfc.nasa.gov/DONKI-API/get/` without an API key. Monthly requests respect the service's 60-day maximum window.

- `CME-2024-01-01.json`: CME, 2024-01-01 through 2024-01-31.
- `CME-2024-02-01.json`: CME, 2024-02-01 through 2024-02-29.
- `CME-2024-03-01.json`: CME, 2024-03-01 through 2024-03-31.
- `CME.json`, `SEP.json`, `GST.json`, `FLR.json`: corresponding endpoint, 2024-05-01 through 2024-05-31.
- `summary.json`: normalized display records, model coefficients, evaluation counts and SHA-256 hashes of every raw input file.

URLs take `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`. SEP records retain instrument names because some refer to Earth-area instruments or model alerts. The separate Mars particle scenario is grounded in the NASA report below, not inferred from an Earth-area SEP event. Missing Mars impact entries are not interpreted as proof of safety.

Primary sources:

- [NASA DONKI description and API migration notice](https://ccmc.gsfc.nasa.gov/tools/DONKI/)
- [DONKI API documentation](https://ccmc.gsfc.nasa.gov/DONKI/api/)
- [Example ENLIL Mars prediction](https://ccmc.gsfc.nasa.gov/DONKI/view/WSA-ENLIL/31014/-1)
- [NASA report on the May 2024 Mars solar storm](https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm/)
- [NASA Opportunity dust-storm report](https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/)
- [NASA Trek WMTS documentation](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars)

Validation commands: `node build-weather.mjs`, `node overlays.test.mjs`, `npm test`, `node capture-weather.mjs`. The browser test exercises dust, CME, SEP, Earth GST, flares, clearing and a phone viewport. These are functional checks of a training simulation, not mission safety certification.
