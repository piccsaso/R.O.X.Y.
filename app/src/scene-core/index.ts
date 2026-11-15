import Ajv from "ajv";
import sceneSchema from "../../../schema/scene.schema.json";
import landmarkSchema from "../../../schema/landmarks.schema.json";
import type {
  Grid,
  Landmark,
  Layout,
  SceneManifest,
  ScenePackage,
  Vec2,
  Vec3,
} from "./types";
export type * from "./types";
const ajv = new Ajv({ allErrors: true });
const checkScene = ajv.compile<SceneManifest>(sceneSchema),
  checkLandmarks = ajv.compile(landmarkSchema);
export function validateMetadata(
  manifest: unknown,
  catalog: unknown,
): asserts manifest is SceneManifest {
  if (!checkScene(manifest))
    throw new Error("scene.json: " + ajv.errorsText(checkScene.errors));
  if (!checkLandmarks(catalog))
    throw new Error("landmarks.json: " + ajv.errorsText(checkLandmarks.errors));
  const m = manifest as SceneManifest,
    landmarks = (catalog as { landmarks: Landmark[] }).landmarks;
  validatePolygon(m.playable_bounds);
  if (new Set(landmarks.map((l) => l.id)).size !== landmarks.length)
    throw new Error("Duplicate landmark ID");
  for (const l of landmarks) {
    if (
      (!l.position || l.position_status === "UNKNOWN") &&
      l.scene_status !== "POSITION_UNVERIFIED"
    )
      throw new Error("Unverified landmark must be informational: " + l.id);
    if (
      l.scene_status === "IN_SCENE_BLOCKED_TARGET" &&
      !l.viewing_points.length
    )
      throw new Error("Blocked target needs viewing point: " + l.id);
    if (
      l.position &&
      l.scene_status.startsWith("IN_SCENE") &&
      !insidePolygon([l.position[0], l.position[2]], m.playable_bounds)
    )
      throw new Error("In-scene landmark outside bounds: " + l.id);
    for (const v of l.viewing_points)
      if (!insidePolygon([v.position[0], v.position[2]], m.playable_bounds))
        throw new Error("Viewing point outside bounds");
  }
  if (new Set(m.overlays.map((o) => o.id)).size !== m.overlays.length)
    throw new Error("Duplicate overlay ID");
  if (!!m.prior_collision !== !!m.prior_ground_grid)
    throw new Error("Prior collision and grid must be paired");
  if (m.prior_ground_grid && !sameLayout(m.ground_grid, m.prior_ground_grid))
    throw new Error("Prior grid layout differs");
  const [ox, oz] = m.ground_grid.origin,
    [w, d] = m.ground_grid.dimensions,
    c = m.ground_grid.cell_size;
  if (
    m.playable_bounds.some(
      ([x, z]) => x < ox || z < oz || x > ox + w * c || z > oz + d * c,
    )
  )
    throw new Error("Grid does not contain playable bounds");
  if (
    !insidePolygon(
      [m.spawn.position[0], m.spawn.position[2]],
      m.playable_bounds,
    )
  )
    throw new Error("Spawn outside bounds");
}
export function validatePolygon(poly: Vec2[]): void {
  const cross = (a: Vec2, b: Vec2, c: Vec2) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const area = poly.reduce((sum, a, i) => {
    const b = poly[(i + 1) % poly.length];
    return sum + a[0] * b[1] - b[0] * a[1];
  }, 0);
  if (
    Math.abs(area) < 1e-9 ||
    new Set(poly.map((p) => p.join(","))).size !== poly.length
  )
    throw new Error("Degenerate playable polygon");
  for (let i = 0; i < poly.length; i++)
    for (let j = i + 1; j < poly.length; j++) {
      if (j === i + 1 || (i === 0 && j === poly.length - 1)) continue;
      const a = poly[i],
        b = poly[(i + 1) % poly.length],
        c = poly[j],
        d = poly[(j + 1) % poly.length];
      const overlap =
        Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <=
          Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) &&
        Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <=
          Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1]));
      if (
        overlap &&
        cross(a, b, c) * cross(a, b, d) <= 0 &&
        cross(c, d, a) * cross(c, d, b) <= 0
      )
        throw new Error("Self-intersecting playable polygon");
    }
}
export function sameLayout(a: Layout, b: Layout) {
  return (
    a.cell_size === b.cell_size &&
    a.encoding === b.encoding &&
    a.origin.every((v, i) => v === b.origin[i]) &&
    a.dimensions.every((v, i) => v === b.dimensions[i])
  );
}
export function validateGrid(
  value: unknown,
  layout: Layout,
): asserts value is Grid {
  const g = value as Grid;
  if (
    !g ||
    g.schema_version !== "1.0.0" ||
    g.path !== layout.path ||
    !Array.isArray(g.origin) ||
    !Array.isArray(g.dimensions) ||
    g.origin.length !== 2 ||
    g.dimensions.length !== 2 ||
    !sameLayout(g, layout)
  )
    throw new Error("Invalid grid layout");
  const n = layout.dimensions[0] * layout.dimensions[1];
  for (const k of ["height", "provenance", "valid", "obstacle"] as const)
    if (!Array.isArray(g[k]) || g[k].length !== n)
      throw new Error("Invalid grid " + k + " length");
  for (let i = 0; i < n; i++) {
    if (![0, 1].includes(g.valid[i]) || ![0, 1].includes(g.obstacle[i]))
      throw new Error("Invalid grid mask");
    if (
      g.valid[i] === 0
        ? g.height[i] !== null || g.provenance[i] !== "UNKNOWN"
        : !Number.isFinite(g.height[i]) ||
          ![
            "ROVER_MEASURED",
            "ROVER_STEREO",
            "ORBITAL",
            "INTERPOLATED",
          ].includes(g.provenance[i])
    )
      throw new Error("Invalid grid cell " + i);
  }
}
export type Reader = (path: string) => Promise<unknown>;
export async function loadScene(read: Reader): Promise<ScenePackage> {
  const [raw, catalog] = await Promise.all([
    read("scene.json"),
    read("landmarks.json"),
  ]);
  validateMetadata(raw, catalog);
  const [grid, prior] = await Promise.all([
    read(raw.ground_grid.path),
    raw.prior_ground_grid ? read(raw.prior_ground_grid.path) : undefined,
  ]);
  validateGrid(grid, raw.ground_grid);
  if (prior) validateGrid(prior, raw.prior_ground_grid!);
  const scene = {
    manifest: raw,
    landmarks: (catalog as { landmarks: Landmark[] }).landmarks,
    grid,
    priorGrid: prior as Grid | undefined,
  };
  const spawn = cellAt(grid, raw.spawn.position[0], raw.spawn.position[2]);
  if (!spawn?.valid || spawn.obstacle)
    throw new Error("Spawn lacks clear ground");
  return scene;
}
export async function loadSceneURL(base: string): Promise<ScenePackage> {
  return loadScene(async (path) => {
    const r = await fetch(base + path);
    if (!r.ok) throw new Error(path + ": HTTP " + r.status);
    return r.json();
  });
}
export function insidePolygon([x, z]: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i],
      [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi)
      inside = !inside;
  }
  return inside;
}
export function cellAt(g: Grid, x: number, z: number) {
  const i = Math.floor((x - g.origin[0]) / g.cell_size),
    j = Math.floor((z - g.origin[1]) / g.cell_size),
    [w, d] = g.dimensions;
  if (i < 0 || j < 0 || i >= w || j >= d) return null;
  const index = j * w + i;
  return {
    i,
    j,
    index,
    height: g.height[index],
    valid: !!g.valid[index],
    obstacle: !!g.obstacle[index],
    provenance: g.provenance[index],
  };
}
export function groundHeight(g: Grid, x: number, z: number): number | null {
  const cell = cellAt(g, x, z);
  if (!cell?.valid) return null;
  // Bilinear sampling only across continuous valid ground; discontinuities retain
  // their cell height so a ledge is never blended into a walkable ramp.
  const u = (x - g.origin[0]) / g.cell_size - 0.5,
    v = (z - g.origin[1]) / g.cell_size - 0.5,
    i = Math.floor(u),
    j = Math.floor(v),
    [w, d] = g.dimensions;
  if (i < 0 || j < 0 || i + 1 >= w || j + 1 >= d) return cell.height;
  const ids = [j * w + i, j * w + i + 1, (j + 1) * w + i, (j + 1) * w + i + 1];
  if (ids.some((k) => !g.valid[k] || g.obstacle[k])) return cell.height;
  const h = ids.map((k) => g.height[k]!);
  if (Math.max(...h) - Math.min(...h) > g.cell_size) return cell.height;
  const a = u - i,
    b = v - j;
  return (
    (1 - a) * (1 - b) * h[0] +
    a * (1 - b) * h[1] +
    (1 - a) * b * h[2] +
    a * b * h[3]
  );
}
export function groundNormal(
  g: Grid,
  x: number,
  z: number,
  baseline = 1,
): Vec3 | null {
  const h = groundHeight(g, x, z);
  if (h === null) return null;
  const r = baseline / 2,
    l = groundHeight(g, x - r, z),
    e = groundHeight(g, x + r, z),
    n = groundHeight(g, x, z - r),
    s = groundHeight(g, x, z + r);
  const dx =
    l !== null && e !== null
      ? (e - l) / baseline
      : e !== null
        ? (e - h) / r
        : l !== null
          ? (h - l) / r
          : 0;
  const dz =
    n !== null && s !== null
      ? (s - n) / baseline
      : s !== null
        ? (s - h) / r
        : n !== null
          ? (h - n) / r
          : 0;
  const len = Math.hypot(dx, 1, dz);
  return [-dx / len, 1 / len, -dz / len];
}
export function provenanceAt(g: Grid, x: number, z: number) {
  return cellAt(g, x, z)?.provenance ?? "UNKNOWN";
}
export function localToMap(m: SceneManifest, p: Vec3) {
  const t = m.map_transform;
  if (t.status === "NONE") return null;
  const rad = Math.PI / 180;
  return {
    latitude: t.latitude! - p[2] / t.radius_m! / rad,
    longitude:
      t.longitude! + p[0] / (t.radius_m! * Math.cos(t.latitude! * rad)) / rad,
    status: t.status,
    error_m: t.error_m,
  };
}
export function mapToLocal(
  m: SceneManifest,
  latitude: number,
  longitude: number,
  y = 0,
): Vec3 | null {
  const t = m.map_transform;
  if (t.status === "NONE") return null;
  const rad = Math.PI / 180;
  return [
    (longitude - t.longitude!) *
      rad *
      t.radius_m! *
      Math.cos(t.latitude! * rad),
    y,
    -(latitude - t.latitude!) * rad * t.radius_m!,
  ];
}
export function normalise(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        row[j] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return row[b.length];
}
export function searchLandmarks(landmarks: Landmark[], text: string) {
  const q = normalise(text);
  if (!q) return { results: [], ambiguous: false };
  const results = landmarks
    .map((landmark) => ({
      landmark,
      score: Math.max(
        ...[landmark.display_name, ...landmark.aliases]
          .map(normalise)
          .map((s) =>
            s === q
              ? 1
              : s.split(" ").includes(q)
                ? 0.9
                : s.startsWith(q)
                  ? 0.85
                  : 1 - distance(q, s) / Math.max(q.length, s.length),
          ),
      ),
    }))
    .filter((r) => r.score >= 0.35)
    .sort(
      (a, b) => b.score - a.score || a.landmark.id.localeCompare(b.landmark.id),
    );
  return {
    results,
    ambiguous:
      results.length > 1 && results[0].score - results[1].score <= 0.08,
  };
}
