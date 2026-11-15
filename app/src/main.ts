import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { loadSceneURL } from "./scene-core";
import {
  navigation,
  resetWalker,
  tickWalker,
  checkPosition,
} from "./walker/controller";
import type { WalkerState } from "./walker/controller";
import "./style.css";
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<canvas id="world" aria-label="First-person terrain view"></canvas>
<div class="visor" aria-label="Helmet HUD shell">
  <header class="identity"><span class="dot"></span> MARSWALK <span class="edition">/ ASTRA 01</span></header>
  <div id="test-data" hidden>TEST DATA</div>
  <section id="hud-heading-tape" class="hud-region heading" aria-label="Heading tape" data-region="heading-tape"><span class="region-label">HEADING TAPE</span></section>
  <section id="hud-route-guidance" class="hud-region route" aria-label="Route guidance" data-region="route-guidance"><span class="region-label">ROUTE GUIDANCE</span></section>
  <section id="hud-hazard-radar" class="hud-region radar" aria-label="Hazard radar" data-region="hazard-radar"><span class="region-label">HAZARD RADAR</span></section>
  <section id="hud-status-gauges" class="hud-region gauges" aria-label="Status gauges" data-region="status-gauges"><span class="region-label">STATUS GAUGES</span></section>
  <section id="hud-alerts" class="hud-region alerts" aria-label="Alerts" data-region="alerts"><span class="region-label">ALERTS</span></section>
  <section id="hud-recognised-voice-text" class="hud-region voice" aria-label="Recognised voice text" data-region="recognised-voice-text"><span class="region-label">RECOGNISED VOICE TEXT</span></section>
  <div class="reticle" aria-hidden="true"></div>
  <footer><span id="scene-name">LOADING SCENE</span><span>W A S D &nbsp; WALK &nbsp; · &nbsp; MOUSE &nbsp; LOOK &nbsp; · &nbsp; R &nbsp; RESET &nbsp; · &nbsp; ESC &nbsp; RELEASE</span></footer>
</div>
<div id="entry"><div class="entry-card"><p class="eyebrow">SURFACE REHEARSAL / FIRST-PERSON</p><h1>Step onto<br>the surface.</h1><p id="load-message">Loading scene package…</p><button id="enter" disabled>Enter visor <span>&gt;</span></button><p class="hint">Click to capture your mouse. Press Esc to release.</p></div></div>
<div id="walk-feedback" role="status"></div>
<details id="settings"><summary>Navigation assumptions & credits</summary><div id="settings-content"></div></details>`;
const message = document.querySelector("#load-message")!,
  button = document.querySelector<HTMLButtonElement>("#enter")!,
  entry = document.querySelector<HTMLElement>("#entry")!;
async function start() {
  const id = new URLSearchParams(location.search).get("scene") ?? "test_scene";
  if (!/^[\w-]+$/.test(id)) throw new Error("Invalid scene ID");
  const base = `/scenes/${id}/`,
    s = await loadSceneURL(base),
    canvas = document.querySelector<HTMLCanvasElement>("#world")!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  const world = new THREE.Scene();
  world.background = new THREE.Color("#b78d70");
  world.fog = new THREE.Fog("#b78d70", 35, 100);
  const camera = new THREE.PerspectiveCamera(
    65,
    innerWidth / innerHeight,
    0.05,
    300,
  );
  camera.rotation.order = "YXZ";
  world.add(new THREE.HemisphereLight(0xffe5cb, 0x493b35, 2.4));
  const sun = new THREE.DirectionalLight(0xffedd4, 3);
  sun.position.set(-20, 35, 15);
  world.add(sun);
  const gltf = await new GLTFLoader().loadAsync(base + s.manifest.terrain);
  gltf.scene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      if (!o.geometry.getAttribute("normal")) o.geometry.computeVertexNormals();
      for (const mat of Array.isArray(o.material) ? o.material : [o.material])
        if (mat.map) {
          mat.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
          mat.map.minFilter = THREE.LinearMipmapLinearFilter;
        }
    }
  });
  world.add(gltf.scene);
  let state = resetWalker(s),
    heading = state.heading,
    pitch = 0;
  const initial = checkPosition(s, state.x, state.z);
  if (initial) throw new Error("Spawn is not walkable: " + initial);
  document.querySelector<HTMLElement>("#test-data")!.hidden =
    !s.manifest.is_test_data;
  document.querySelector("#scene-name")!.textContent =
    s.manifest.title.toUpperCase();
  message.textContent = s.manifest.is_test_data
    ? "Synthetic terrain · collision and navigation proving ground"
    : "Scene loaded · ready to explore";
  button.disabled = false;
  const settings = document.querySelector("#settings-content")!;
  for (const [key, setting] of Object.entries(navigation)) {
    const p = document.createElement("p");
    p.textContent = `${key}: ${setting.value} — ${setting.label}. ${setting.rationale}`;
    settings.append(p);
  }
  for (const credit of s.manifest.credits) {
    const p = document.createElement("p");
    p.textContent = JSON.stringify(credit);
    settings.append(p);
  }
  const keys = new Set<string>();
  const lock = () => canvas.requestPointerLock();
  button.addEventListener("click", lock);
  canvas.addEventListener("click", lock);
  document.addEventListener("pointerlockchange", () => {
    entry.hidden = document.pointerLockElement === canvas;
    keys.clear();
  });
  document.addEventListener("pointerlockerror", () => {
    message.textContent = "Mouse capture failed. Click Enter visor again.";
  });
  document.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement !== canvas) return;
    heading += e.movementX * 0.12;
    pitch = THREE.MathUtils.clamp(pitch - e.movementY * 0.002, -1.45, 1.45);
  });
  document.addEventListener("keydown", (e) => {
    if (document.pointerLockElement !== canvas) return;
    if (e.code === "Escape") {
      document.exitPointerLock();
      keys.clear();
      return;
    }
    keys.add(e.code);
    if (e.code === "KeyR") {
      state = resetWalker(s);
      heading = state.heading;
      pitch = 0;
    }
    if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyR"].includes(e.code))
      e.preventDefault();
  });
  document.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", () => keys.clear());
  window.addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  let last = performance.now();
  const feedback = document.querySelector("#walk-feedback")!;
  function animate(now: number) {
    const dt = (now - last) / 1000;
    last = now;
    if (document.pointerLockElement === canvas)
      state = tickWalker(
        s,
        state,
        {
          forward: Number(keys.has("KeyW")) - Number(keys.has("KeyS")),
          right: Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
          heading,
        },
        dt,
      );
    camera.position.set(
      state.x,
      state.y + s.manifest.spawn.eye_height,
      state.z,
    );
    camera.rotation.set(pitch, (-heading * Math.PI) / 180, 0);
    feedback.textContent = state.blocked
      ? `Movement blocked · ${state.blocked}`
      : (state.warning ?? "");
    renderer.render(world, camera);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
  // Explicit test mode only on synthetic fixtures; browser tests still drive real keyboard events.
  if (
    s.manifest.is_test_data &&
    new URLSearchParams(location.search).get("test") === "1"
  )
    Object.assign(window, {
      __walker: {
        get: () => ({ ...state }),
        set: (p: WalkerState) => {
          state = { ...p };
          heading = p.heading;
          pitch = 0;
        },
        scene: s,
        ready: true,
      },
    });
}
start().catch((error) => {
  message.textContent = String(error);
  button.textContent = "Unable to load scene";
  console.error(error);
});
