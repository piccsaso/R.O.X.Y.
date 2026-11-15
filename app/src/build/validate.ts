import { readFile, access } from "node:fs/promises";
import { resolve, join } from "node:path";
import { loadScene } from "../scene-core";
import { collisionTriangles } from "./grid";
export async function validateSceneDirectory(directory: string) {
  const dir = resolve(directory),
    s = await loadScene(async (path) =>
      JSON.parse(await readFile(join(dir, path), "utf8")),
    ),
    m = s.manifest;
  for (const path of [
    m.terrain,
    m.collision,
    m.prior_collision,
    ...m.overlays.map((o) => o.path),
    ...m.routes.map((r) => r.path),
    ...s.landmarks.map((l) => l.science.photo?.path),
  ].filter(Boolean) as string[])
    await access(join(dir, path));
  await collisionTriangles(join(dir, m.collision));
  if (m.prior_collision) await collisionTriangles(join(dir, m.prior_collision));
  console.log(
    `VALID ${m.scene_id}: ${s.grid.valid.length} grid cells, ${s.landmarks.length} landmarks`,
  );
  return s;
}
