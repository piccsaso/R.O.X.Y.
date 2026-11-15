import { Document, NodeIO } from "@gltf-transform/core";
import { PNG } from "pngjs";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { buildGroundGrid } from "./grid";
import type { Vec3 } from "../scene-core";
const dir = fileURLToPath(
  new URL("../../../scenes/test_scene/", import.meta.url),
);
const bounds = [
  [-30, -20],
  [30, -20],
  [30, 20],
  [-30, 20],
];
const layout = {
  path: "ground_grid.json",
  cell_size: 0.25,
  origin: [-30, -20],
  dimensions: [240, 160],
  encoding: "json-row-major-v1",
};
const base = (x: number, z: number) => 0.025 * x + 0.01 * z;
function height(x: number, z: number, prior = false) {
  let y = base(x, z);
  if (!prior && x >= 8 && x <= 12 && z >= -16 && z <= -9) y += (x - 8) * 0.85;
  if (!prior && x >= 15 && z >= 7 && z <= 15) y += 1.5;
  return y;
}
async function geometry(prior: boolean, visual: boolean, path: string) {
  const doc = new Document(),
    buffer = doc.createBuffer(),
    scene = doc.createScene();
  doc.getRoot().setDefaultScene(scene);
  function mesh(
    name: string,
    positions: number[],
    color: [number, number, number, number],
  ) {
    const p = doc
      .createPrimitive()
      .setAttribute(
        "POSITION",
        doc
          .createAccessor()
          .setType("VEC3")
          .setArray(new Float32Array(positions))
          .setBuffer(buffer),
      )
      .setMaterial(
        doc
          .createMaterial()
          .setBaseColorFactor(color)
          .setRoughnessFactor(0.95)
          .setDoubleSided(true),
      );
    scene.addChild(
      doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(p)),
    );
  }
  const vertices: number[] = [];
  for (let z = -20; z < 20; z += 0.5)
    for (let x = -30; x < 30; x += 0.5) {
      if (!prior && x >= -13 && x < -9 && z >= 7 && z < 11) continue;
      // Sample each tile from its interior to keep the ledge and band ends vertical.
      const tile = (xx: number, zz: number) => {
        let y = base(xx, zz);
        if (!prior && x >= 8 && x < 12 && z >= -16 && z < -9)
          y += (xx - 8) * 0.85;
        if (!prior && x >= 15 && z >= 7 && z < 15) y += 1.5;
        return y;
      };
      const a = [x, tile(x, z), z],
        b = [x + 0.5, tile(x + 0.5, z), z],
        c = [x, tile(x, z + 0.5), z + 0.5],
        d = [x + 0.5, tile(x + 0.5, z + 0.5), z + 0.5];
      vertices.push(...a, ...c, ...b, ...b, ...c, ...d);
    }
  mesh(
    prior ? "ground_ORBITAL" : "ground_ROVER_MEASURED",
    vertices,
    visual ? [0.46, 0.25, 0.13, 1] : [0.6, 0.4, 0.2, 1],
  );
  function box(
    name: string,
    x: number,
    z: number,
    sx: number,
    sz: number,
    h: number,
  ) {
    const y = base(x, z),
      p: Vec3[] = [
        [x - sx / 2, y, z - sz / 2],
        [x + sx / 2, y, z - sz / 2],
        [x + sx / 2, y, z + sz / 2],
        [x - sx / 2, y, z + sz / 2],
        [x - sx / 2, y + h, z - sz / 2],
        [x + sx / 2, y + h, z - sz / 2],
        [x + sx / 2, y + h, z + sz / 2],
        [x - sx / 2, y + h, z + sz / 2],
      ];
    const ids = [
      0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2,
      6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0,
    ];
    mesh(
      "obstacle_" + name,
      ids.flatMap((i) => p[i]),
      [0.22, 0.15, 0.12, 1],
    );
  }
  if (!prior) {
    // Irregular faceted boulder blocks the direct west/east line to the target.
    const rock: number[] = [];
    const ring = Array.from({ length: 10 }, (_, i) => {
      const a = (i * Math.PI) / 5;
      return [
        -4 + 2 * Math.cos(a),
        base(-4, 0) + 0.15,
        2 * Math.sin(a),
      ] as Vec3;
    });
    const shoulder = ring.map(
        (p, i) =>
          [
            -4 + (p[0] + 4) * 0.63,
            base(-4, 0) + 2.1 + (i % 3) * 0.12,
            p[2] * 0.63,
          ] as Vec3,
      ),
      top: Vec3 = [-4.2, base(-4, 0) + 2.8, 0.1];
    for (let i = 0; i < 10; i++) {
      const j = (i + 1) % 10;
      rock.push(
        ...ring[i],
        ...shoulder[i],
        ...ring[j],
        ...ring[j],
        ...shoulder[i],
        ...shoulder[j],
        ...shoulder[i],
        ...top,
        ...shoulder[j],
      );
    }
    mesh("obstacle_boulder", rock, [0.28, 0.19, 0.13, 1]);
    box("corridor_divider", 0, 0, 1, 12, 1.8);
    box("corridor_north_wall", 1, -10, 12, 0.5, 1.4);
    box("corridor_south_wall", 1, 14, 12, 0.5, 1.4);
  }
  if (visual && !prior) {
    const sides: number[] = [];
    const wall = (
      x1: number,
      z1: number,
      h1: number,
      x2: number,
      z2: number,
      h2: number,
    ) => {
      const a = [x1, base(x1, z1), z1],
        b = [x2, base(x2, z2), z2],
        c = [x1, base(x1, z1) + h1, z1],
        d = [x2, base(x2, z2) + h2, z2];
      sides.push(...a, ...b, ...c, ...b, ...d, ...c);
    };
    wall(15, 7, 1.5, 30, 7, 1.5);
    wall(15, 15, 1.5, 30, 15, 1.5);
    wall(15, 7, 1.5, 15, 15, 1.5);
    wall(8, -16, 0, 12, -16, 3.4);
    wall(8, -9, 0, 12, -9, 3.4);
    wall(12, -16, 3.4, 12, -9, 3.4);
    mesh("visual_cliff_sides", sides, [0.37, 0.2, 0.11, 1]);
  }
  await new NodeIO().write(join(dir, path), doc);
}
export async function generateTestScene() {
  await mkdir(join(dir, "overlays"), { recursive: true });
  await mkdir(join(dir, "routes"), { recursive: true });
  const credit = {
    product_id: "ASTRA-SYNTHETIC-1",
    url: "https://github.com/piccsaso/nasa-hackathon",
    credit: "Marswalk team; synthetic test fixture",
    license: "CC0-1.0",
  };
  const manifest = {
    schema_version: "1.0.0",
    scene_id: "test_scene",
    title: "Astra proving ground",
    is_test_data: true,
    units: "metres",
    axes: "+X east, +Y up, -Z north",
    origin: {
      description:
        "Synthetic origin at centre of 60 × 40 m test patch; no Mars registration.",
      site_frame: null,
    },
    map_transform: { status: "NONE" },
    playable_bounds: bounds,
    spawn: { position: [-22, base(-22, 0), 0], heading: 90, eye_height: 1.7 },
    terrain: "terrain.glb",
    collision: "collision.glb",
    prior_collision: "prior_collision.glb",
    landmarks: "landmarks.json",
    ground_grid: layout,
    prior_ground_grid: { ...layout, path: "prior_ground_grid.json" },
    overlays: [
      {
        id: "exposure",
        name: "Simulated exposure test field",
        path: "overlays/exposure.png",
        format: "png",
        data_class: "TEST-DATA",
        units: "relative risk (Simulated)",
        resolution: 0.25,
        coverage: bounds,
        bounds: [-30, -20, 30, 20],
        value_range: [0, 1],
        source: credit.url,
        credit: credit.credit,
        license: credit.license,
        provenance_notes:
          "Synthetic scenario: short north corridor is high exposure; no dose prediction.",
        default_visible: false,
        render_mode: "both",
      },
      {
        id: "exclusion",
        name: "Simulated exclusion zone",
        path: "overlays/exclusion.geojson",
        format: "geojson",
        data_class: "TEST-DATA",
        units: "scenario exclusion",
        resolution: 0,
        coverage: [
          [20, -7],
          [25, -7],
          [25, -3],
          [20, -3],
        ],
        source: credit.url,
        credit: credit.credit,
        license: credit.license,
        provenance_notes:
          "Synthetic hard exclusion for Astra 2 scenario tests.",
        default_visible: false,
        render_mode: "both",
      },
    ],
    routes: [],
    credits: [credit],
  };
  const landmark = (
    id: string,
    name: string,
    aliases: string[],
    p: Vec3,
    status: string,
    views: unknown[] = [],
  ) => ({
    id,
    display_name: name,
    aliases,
    kind: status === "IN_SCENE_BLOCKED_TARGET" ? "rock" : "feature",
    position: p,
    position_status: "VERIFIED",
    scene_status: status,
    viewing_points: views,
    science: {
      description: "Synthetic fixture, not an observation of Mars.",
      instruments: [],
      products: [],
      sol: null,
      site_drive: null,
      data_class: "TEST-DATA",
    },
    sources: [credit],
  });
  const catalog = {
    schema_version: "1.0.0",
    landmarks: [
      landmark(
        "beacon",
        "East Beacon",
        ["target", "beacon"],
        [22, height(22, 0), 0],
        "IN_SCENE_REACHABLE",
      ),
      landmark(
        "amber-rock",
        "Amber Rock",
        ["amber", "rock"],
        [-4, base(-4, 0) + 2.8, 0],
        "IN_SCENE_BLOCKED_TARGET",
        [{ id: "west-view", position: [-8, base(-8, 0), 0], facing: 90 }],
      ),
      landmark(
        "amber-ridge",
        "Amber Ridge",
        ["amber", "ridge"],
        [22, height(22, 12), 12],
        "IN_SCENE_REACHABLE",
      ),
      landmark(
        "distant",
        "Distant Crater",
        ["crater"],
        [90, 0, 0],
        "OUTSIDE_PATCH",
      ),
    ],
  };
  await writeFile(
    join(dir, "scene.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  await writeFile(
    join(dir, "spawn.json"),
    JSON.stringify(manifest.spawn, null, 2) + "\n",
  );
  await writeFile(
    join(dir, "landmarks.json"),
    JSON.stringify(catalog, null, 2) + "\n",
  );
  await geometry(false, false, "collision.glb");
  await geometry(true, false, "prior_collision.glb");
  await geometry(false, true, "terrain.glb");
  const png = new PNG({ width: 240, height: 160 });
  for (let j = 0; j < 160; j++)
    for (let i = 0; i < 240; i++) {
      const x = -30 + (i + 0.5) * 0.25,
        z = -20 + (j + 0.5) * 0.25,
        k = (j * 240 + i) * 4,
        value = x >= -7 && x <= 8 && z >= -10 && z <= -6 ? 255 : 25;
      png.data[k] = png.data[k + 1] = png.data[k + 2] = value;
      png.data[k + 3] = 255;
    }
  await writeFile(join(dir, "overlays/exposure.png"), PNG.sync.write(png));
  await writeFile(
    join(dir, "overlays/exclusion.geojson"),
    JSON.stringify(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {
              id: "exclusion",
              data_class: "TEST-DATA",
              simulated: true,
            },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [20, -7],
                  [25, -7],
                  [25, -3],
                  [20, -3],
                  [20, -7],
                ],
              ],
            },
          },
        ],
      },
      null,
      2,
    ),
  );
  await writeFile(join(dir, "routes/.gitkeep"), "");
  await buildGroundGrid(dir);
  console.log("Generated deterministic test_scene");
}
