# Observation overlays

Click the circular Roxy launcher at the bottom to unfold the rounded control strip, then choose **Overlays**. The launcher contains a replaceable ring icon placeholder. Select the active layer again, or Natural terrain, to clear it. Terrain overlays use fixed opacity and a compact legend directly below the minimap. Thermal observations occupy the regional minimap. Minerals use a uniform regional TES context tint on verified model terrain, with a native-colour legend below the minimap. Selecting an overlay opens no information window. Slope and Ground truth are also available in Overlays. Typed/voice commands include “show hazards”, “show minerals”, “show thermal” and “show topography”.

## Roxy voice commands

Roxy starts enabled when the page loads. Allow the browser microphone permission prompt to use voice. Turn it off using the microphone control below the minimap or **Options → Roxy voice**. The **V** shortcut enables voice again and arms Roxy. If the browser blocks automatic startup, click the microphone control to retry.

Say **“Roxy”** to unfold the control strip silently. Say **“open the overlay tab”**, then name an overlay; or say **“Roxy, go to trafficability”** to show it directly. Microphone recognition stays active while voice audio is requested, pauses only during playback, and resumes afterward. Slow audio requests fall back to browser speech after three seconds. Roxy captions show recognized instructions and brief replies. There is no inactivity auto-close: the controls and command listening remain active until you close them or turn voice off. Mute suppresses spoken replies. Click the launcher again to collapse it. Reduced-motion preferences disable the expansion animation. Say “Roxy, show topography”, “Roxy, show trafficability”, “Roxy, show minerals”, or “Roxy, show thermals”. You can also say “Roxy, make topography visible”.

Aliases include topo/elevation/topographic, traffic/traversability/hazards, mineral/resources, and thermal/regolith/infrared. Use “hide” or “turn … off” to hide a layer. Saying a layer keyword alone toggles it. One layer is selected at a time. Mineral commands show the regional context tint on the model; thermal commands show the regional observation map. These phrases also work through the existing typed command input without the Roxy wake word.

On localhost port 8086, hard-refresh after code changes. If voice is unavailable in the embedded viewer, open the same URL in Chrome or Edge. The microphone control shows starting/listening, blocked permission, missing microphone, or service failure; click it to retry after fixing the cause. Press **T** for typed commands.

Voice input uses browser speech recognition, which may send microphone audio to an online service, and requires a supported browser and microphone permission.

## Terrain derivatives

Trafficability uses the existing Navcam-derived model: slope across 0.8 m and the existing navigation footing test (>0.17 m height difference around a 0.16 m radius). Lower slope is green (<15°); caution is yellow (15–25°); red marks ≥25° or uneven footing. These are prototype thresholds, not validated astronaut or rover limits. Sand, bearing strength and subsurface hazards are not measured. Inferred/context support is gray, never marked green.

Topography uses local model heights with 1 m contours, relative to the minimum supported height. Inferred/context support is transparent. This is not a MOLA datum. Support follows the existing terrain-coverage image; only cells with both triangles supported qualify. Trafficability also requires support at its slope and footing sample positions. Partial support is conservatively treated as unknown. This is not a per-pixel uncertainty estimate. The underlying scene still contains inferred terrain.

## Real orbital observations

Both observation layers retain original NASA Trek tile colours. Minerals sample pixel (220, 203) from the TES tile at the rover reference location and apply that single native colour uniformly to verified terrain. This is regional composition context, not spatially resolved mineral mapping; no abundance scale or local patches are inferred. Unverified terrain remains untinted. Thermal data remains a regional map. No synthetic mineral or thermal data are generated. Its white marker locates the project's documented sol-477 rover reference (18.45889532° N, 77.40616768° E; see SKY.md and sky-data.json). It is not a surveyed alignment of every local mesh vertex.

| Layer | Product | Matrix / row / column | Display scope |
|---|---|---|---|
| Minerals & resources | TES_Clinopyroxene | 1 / 0 / 2 | 0–90° E, 0–90° N; coarse regional composition context |
| Thermal & regolith | THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018 | 9 / 203 / 732 | 77.34375–77.6953125° E, 18.28125–18.6328125° N |

Tiles and their WMTS capabilities are stored under observations/. The documented matrix origin is (-180°, 90°), with 256-pixel tiles, 2^(z+1) columns and 2^z rows. The THEMIS rendered grid spacing is approximately 81 m north–south using the Mars radius in sky-data.json; its source mosaic is named 100 m. The local model is only 56 × 49.07 m, so this imagery cannot provide individual rock or regolith classifications. TES rendering is much coarser still. No quantitative values are decoded from colour tiles, and no colour-to-abundance or temperature scale is invented.

Mineral classes in the supplied conceptual image (clays, carbonates, sulfates) are **not implemented as detections**. A registered CRISM summary-parameter product, quality masks and verified interpretation are still needed for those layers. Thermal inertia, dust/sand classification, resource abundance and ice extraction targets are likewise not established by these tiles.

Sources retrieved 2026-11-15:

- [NASA Trek WMTS documentation](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars)
- [TES clinopyroxene capabilities](https://trek.nasa.gov/tiles/Mars/EQ/TES_Clinopyroxene/1.0.0/WMTSCapabilities.xml)
- [THEMIS capabilities](https://trek.nasa.gov/tiles/Mars/EQ/THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018/1.0.0/WMTSCapabilities.xml)
- [CRISM archive and product descriptions](https://pds-geosciences.wustl.edu/missions/mro/crism.htm)
- [THEMIS archive](https://pds-geosciences.wustl.edu/missions/odyssey/themis.html)

Tile URLs follow `<endpoint>/1.0.0/default/default028mm/<matrix>/<row>/<column>.png`. This is an equirectangular matrix, not Web Mercator XYZ. The saved capabilities retain the exact endpoints and bounds.

Validation: `node overlays.test.mjs`, `npm test`, and `node capture-overlays.mjs`. The browser capture checks each layer, regional-image loading, fixed opacity, clearing, and narrow viewport layout.

Roxy executes map and menu commands without spoken prompts; captions remain available. Route and overlay callouts are brief. Recognition requests up to five transcript alternatives, accepts spaced terms such as “traffic ability,” and ignores duplicate final-result callbacks within a recognition session. Unknown commands leave Roxy listening for a correction without a timeout. Press **V** to arm listening without a wake word. These changes improve command handling; live recognition quality depends on the browser, microphone, and environment.

Click the circular launcher or press **V** to arm listening without the wake word. **V** also interrupts a spoken reply. Transient recognition network errors retry up to three times; permission and device errors require user action. Recognition restart does not depend on the browser emitting an end event after cancellation.

Closing the controls exits command mode; Roxy continues listening for its wake word until voice is turned off.
