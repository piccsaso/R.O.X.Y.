import { NodeIO } from "@gltf-transform/core";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { validateMetadata, validateGrid } from "../scene-core";
import type { Grid, Layout, Provenance, Vec3 } from "../scene-core";
export interface Triangle {
  points: [Vec3, Vec3, Vec3];
  provenance: Provenance;
  obstacle: boolean;
}
export async function collisionTriangles(path: string): Promise<Triangle[]> {
  const doc = await new NodeIO().read(path),
    triangles: Triangle[] = [];
  if (doc.getRoot().listExtensionsUsed().length)
    throw new Error("Collision extensions are unsupported: " + path);
  const scene =
    doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  if (!scene) throw new Error("No collision scene");
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh) return;
    const name = node.getName(),
      obstacle = /^obstacle_.+/.test(name),
      match =
        /^ground_(ROVER_MEASURED|ROVER_STEREO|ORBITAL|INTERPOLATED)$/.exec(
          name,
        );
    if (!obstacle && !match)
      throw new Error("Unclassified collision node: " + name);
    if (node.getSkin()) throw new Error("Skinned collision unsupported");
    const m = node.getWorldMatrix();
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMode() !== 4 || primitive.listTargets().length)
        throw new Error("Collision must be static triangles");
      const pos = primitive.getAttribute("POSITION");
      if (!pos) throw new Error("Missing POSITION");
      const idx = primitive.getIndices(),
        count = idx?.getCount() ?? pos.getCount();
      if (count % 3) throw new Error("Incomplete triangle");
      for (let k = 0; k < count; k += 3) {
        const points: Vec3[] = [];
        for (let t = 0; t < 3; t++) {
          const v = pos.getElement(
            idx ? idx.getScalar(k + t) : k + t,
            [0, 0, 0],
          ) as Vec3;
          points.push([
            m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
            m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
            m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
          ]);
        }
        if (points.flat().some((v) => !Number.isFinite(v)))
          throw new Error("Non-finite geometry");
        triangles.push({
          points: points as [Vec3, Vec3, Vec3],
          provenance: match ? (match[1] as Provenance) : "UNKNOWN",
          obstacle,
        });
      }
    }
  });
  if (!triangles.some((t) => !t.obstacle))
    throw new Error("Collision has no ground");
  return triangles;
}
function rayHeight(
  [a, b, c]: [Vec3, Vec3, Vec3],
  x: number,
  z: number,
): number | null {
  const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
  if (Math.abs(det) < 1e-12) return null;
  const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det,
    v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det,
    w = 1 - u - v;
  return Math.min(u, v, w) >= -1e-8 ? u * a[1] + v * b[1] + w * c[1] : null;
}
// Separating-axis test includes degenerate projections (vertical obstacle walls).
function overlaps(points: Vec3[], x: number, z: number, size: number) {
  const axes = [
    [1, 0],
    [0, 1],
    ...points.map((p, i) => [
      p[2] - points[(i + 1) % 3][2],
      points[(i + 1) % 3][0] - p[0],
    ]),
  ];
  for (const [ax, az] of axes) {
    const p = points.map((v) => v[0] * ax + v[2] * az),
      q = [
        [x, z],
        [x + size, z],
        [x, z + size],
        [x + size, z + size],
      ].map((v) => v[0] * ax + v[1] * az);
    if (
      Math.max(...p) < Math.min(...q) - 1e-9 ||
      Math.min(...p) > Math.max(...q) + 1e-9
    )
      return false;
  }
  return true;
}
export function rasterize(triangles: Triangle[], layout: Layout): Grid {
  const [w, d] = layout.dimensions,
    [ox, oz] = layout.origin,
    c = layout.cell_size,
    n = w * d;
  const grid: Grid = {
    ...layout,
    schema_version: "1.0.0",
    height: Array(n).fill(null),
    provenance: Array(n).fill("UNKNOWN"),
    valid: Array(n).fill(0),
    obstacle: Array(n).fill(0),
  };
  for (const t of triangles) {
    const xs = t.points.map((v) => v[0]),
      zs = t.points.map((v) => v[2]);
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - ox) / c) - 1),
      i1 = Math.min(w - 1, Math.floor((Math.max(...xs) - ox) / c));
    const j0 = Math.max(0, Math.floor((Math.min(...zs) - oz) / c) - 1),
      j1 = Math.min(d - 1, Math.floor((Math.max(...zs) - oz) / c));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const k = j * w + i,
          x = ox + i * c,
          z = oz + j * c;
        if (t.obstacle) {
          if (overlaps(t.points, x, z, c)) grid.obstacle[k] = 1;
          continue;
        }
        const y = rayHeight(t.points, x + c / 2, z + c / 2);
        if (y !== null && (grid.height[k] === null || y > grid.height[k]!)) {
          grid.height[k] = y;
          grid.valid[k] = 1;
          grid.provenance[k] = t.provenance;
        }
      }
  }
  validateGrid(grid, layout);
  return grid;
}
export async function buildGroundGrid(directory: string) {
  const dir = resolve(directory),
    m = JSON.parse(await readFile(join(dir, "scene.json"), "utf8")),
    catalog = JSON.parse(await readFile(join(dir, "landmarks.json"), "utf8"));
  validateMetadata(m, catalog);
  for (const [file, layout] of [
    [m.collision, m.ground_grid],
    [m.prior_collision, m.prior_ground_grid],
  ] as const)
    if (file && layout) {
      const ts = await collisionTriangles(join(dir, file)),
        g = rasterize(ts, layout);
      await writeFile(join(dir, layout.path), JSON.stringify(g));
      console.log(
        `${file}: ${ts.length} triangles; ${g.valid.filter(Boolean).length}/${g.valid.length} valid; ${g.obstacle.filter(Boolean).length} obstacle cells -> ${layout.path}`,
      );
    }
}
