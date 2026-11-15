import { beforeAll, describe, expect, it } from "vitest";
import { readFile, mkdtemp, cp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";
import {
  loadScene,
  validateMetadata,
  validateGrid,
  groundHeight,
  groundNormal,
  provenanceAt,
  searchLandmarks,
  localToMap,
  mapToLocal,
  cellAt,
} from "../src/scene-core";
import type { ScenePackage, Vec3, Layout } from "../src/scene-core";
import type { WalkerState } from "../src/walker/controller";
import {
  checkPosition,
  moveWalker,
  resetWalker,
  tickWalker,
  navigation,
} from "../src/walker/controller";
import {
  rasterize,
  collisionTriangles,
  buildGroundGrid,
} from "../src/build/grid";
import { validateSceneDirectory } from "../src/build/validate";
let s: ScenePackage;
const dir = resolve("../scenes/test_scene");
beforeAll(async () => {
  s = await loadScene(async (p) =>
    JSON.parse(await readFile(join(dir, p), "utf8")),
  );
});
const state = (x: number, z: number, heading = 90): WalkerState => ({
  x,
  z,
  y: groundHeight(s.grid, x, z)!,
  heading,
  blocked: null,
  warning: null,
});
describe("scene package contract", () => {
  it("validates the complete generated package and rejects a broken copy", async () => {
    await validateSceneDirectory(dir);
    const temp = await mkdtemp(join(tmpdir(), "astra-broken-"));
    try {
      await cp(dir, temp, { recursive: true });
      const broken = structuredClone(s.manifest);
      (broken as unknown as { units: string }).units = "feet";
      await writeFile(join(temp, "scene.json"), JSON.stringify(broken));
      await expect(validateSceneDirectory(temp)).rejects.toThrow("scene.json");
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
  it("rejects invalid masks, null valid heights and shifted prior layout", () => {
    const g = structuredClone(s.grid);
    g.height[0] = null;
    expect(() => validateGrid(g, s.manifest.ground_grid)).toThrow();
    g.height[0] = 0;
    g.obstacle[0] = 2;
    expect(() => validateGrid(g, s.manifest.ground_grid)).toThrow();
    const m = structuredClone(s.manifest);
    m.prior_ground_grid!.origin = [0, 0];
    expect(() =>
      validateMetadata(m, { schema_version: "1.0.0", landmarks: s.landmarks }),
    ).toThrow("Prior grid layout");
  });
  it("rejects duplicate IDs and unknown positions marked reachable", () => {
    const catalog = {
      schema_version: "1.0.0",
      landmarks: [s.landmarks[0], s.landmarks[0]],
    };
    expect(() => validateMetadata(s.manifest, catalog)).toThrow("Duplicate");
    const l = { ...s.landmarks[0], position: null };
    expect(() =>
      validateMetadata(s.manifest, { ...catalog, landmarks: [l] }),
    ).toThrow("Unverified");
  });
  it("rejects malformed grid dimensions and a self-intersecting boundary", () => {
    const g = structuredClone(s.grid);
    g.origin = [-30] as any;
    expect(() => validateGrid(g, s.manifest.ground_grid)).toThrow("layout");
    const m = structuredClone(s.manifest);
    m.playable_bounds = [
      [-30, -20],
      [30, 20],
      [-30, 20],
      [30, -20],
    ];
    expect(() =>
      validateMetadata(m, { schema_version: "1.0.0", landmarks: s.landmarks }),
    ).toThrow("polygon");
  });
  it("accepts optional attributed photo metadata", () => {
    const landmarks = structuredClone(s.landmarks);
    landmarks[0].science.photo = {
      path: "photos/target.jpg",
      image_id: "TEST-1",
      sol: 0,
      camera: "synthetic",
      credit: "Test",
      source_url: "https://example.org",
    };
    expect(() =>
      validateMetadata(s.manifest, { schema_version: "1.0.0", landmarks }),
    ).not.toThrow();
  });
});
describe("sampling, mapping, catalog", () => {
  it("samples the sloping plane and its upward unit normal", () => {
    expect(groundHeight(s.grid, -20, -12)).toBeCloseTo(-0.62, 5);
    const n = groundNormal(s.grid, -20, -12)!;
    expect(n[0]).toBeCloseTo(-0.025 / Math.hypot(0.025, 1, 0.01), 5);
    expect(Math.hypot(...n)).toBeCloseTo(1);
  });
  it("returns UNKNOWN for holes and outside, and preserves the ledge", () => {
    expect(groundHeight(s.grid, -11, 9)).toBeNull();
    expect(provenanceAt(s.grid, -11, 9)).toBe("UNKNOWN");
    expect(provenanceAt(s.grid, 100, 100)).toBe("UNKNOWN");
    expect(
      groundHeight(s.grid, 18, 7.1)! - groundHeight(s.grid, 18, 6.9)!,
    ).toBeGreaterThan(1.4);
  });
  it("never invents map registration; round trips an explicit estimated transform", () => {
    expect(localToMap(s.manifest, [1, 0, 1])).toBeNull();
    expect(mapToLocal(s.manifest, 18, 77)).toBeNull();
    const m = {
      ...s.manifest,
      map_transform: {
        status: "ESTIMATED" as const,
        reference_body: "Mars" as const,
        datum: "test sphere",
        latitude: 18.4,
        longitude: 77.5,
        radius_m: 3396190,
        error_m: 4,
      },
    };
    const p: Vec3 = [12, 3, -8],
      mapped = localToMap(m, p)!;
    expect(mapped.latitude).toBeGreaterThan(18.4);
    expect(mapped.longitude).toBeGreaterThan(77.5);
    const back = mapToLocal(m, mapped.latitude, mapped.longitude, 3)!;
    back.forEach((v, i) => expect(v).toBeCloseTo(p[i], 6));
  });
  it("normalises aliases, ranks typos and flags shared words", () => {
    expect(
      searchLandmarks(s.landmarks, "  ÉAST--BEACON ").results[0].landmark.id,
    ).toBe("beacon");
    expect(searchLandmarks(s.landmarks, "becon").results[0].landmark.id).toBe(
      "beacon",
    );
    expect(searchLandmarks(s.landmarks, "amber").ambiguous).toBe(true);
    expect(
      searchLandmarks(s.landmarks, "crater").results[0].landmark.scene_status,
    ).toBe("OUTSIDE_PATCH");
    expect(searchLandmarks(s.landmarks, " ").results).toEqual([]);
  });
});
describe("pure walker blockers and traversability", () => {
  it.each([
    ["boulder", -8, 0, 8, 0, "obstacle"],
    ["hole", -16, 9, 8, 0, "hole"],
    ["ledge ascent", 18, 5, 0, 5, "slope"],
    ["ledge descent", 18, 9, 0, -5, "slope"],
    ["steep band", 6, -12, 6, 0, "slope"],
    ["boundary", 28, 0, 6, 0, "boundary"],
  ])("%s stops a swept movement", (_name, x, z, dx, dz, reason) => {
    const start = state(x as number, z as number);
    expect(checkPosition(s, start.x, start.z)).toBeNull();
    const end = moveWalker(s, start, dx as number, dz as number);
    expect(end.blocked).toBe(reason);
    expect(Math.hypot(end.x - start.x, end.z - start.z)).toBeLessThan(
      Math.hypot(dx as number, dz as number),
    );
    expect(checkPosition(s, end.x, end.z)).toBeNull();
  });
  it("blocks ledges independently of the slope limit", () => {
    const c = structuredClone(navigation);
    c.max_slope_deg.value = 90;
    expect(moveWalker(s, state(18, 9), 0, -5, c).blocked).toBe("ledge");
    expect(moveWalker(s, state(18, 5), 0, 5, c).blocked).toBe("ledge");
  });
  it("does not tunnel across a hole with a very long move", () => {
    const end = moveWalker(s, state(-20, 9), 40, 0);
    expect(end.blocked).toBe("hole");
    expect(end.x).toBeLessThan(-13);
  });
  it("walks on the gentle plane and reset returns to spawn", () => {
    const start = resetWalker(s),
      end = moveWalker(s, start, 5, -3);
    expect(end.blocked).toBeNull();
    expect(end.y).toBeCloseTo(0.025 * end.x + 0.01 * end.z, 5);
    expect(resetWalker(s)).toEqual(start);
  });
  it("walks both corridors to the same destination", () => {
    for (const z of [-8, 12]) {
      let p = state(-7, 0);
      for (const [x, nextZ] of [
        [-7, z],
        [8, z],
        [8, 0],
        [22, 0],
      ]) {
        p = moveWalker(s, p, x - p.x, nextZ - p.z);
        expect(p.blocked).toBeNull();
      }
      expect(p.x).toBeCloseTo(22);
    }
  });
  it("normalises diagonal speed and clamps delayed frames", () => {
    const a = tickWalker(
        s,
        state(-22, 0),
        { forward: 1, right: 0, heading: 90 },
        100,
      ),
      b = tickWalker(
        s,
        state(-22, 0),
        { forward: 1, right: 1, heading: 90 },
        100,
      );
    expect(Math.hypot(a.x + 22, a.z)).toBeCloseTo(0.2);
    expect(Math.hypot(b.x + 22, b.z)).toBeCloseTo(0.2);
  });
  it("uses prior geometry without boulder or hole", () => {
    expect(cellAt(s.priorGrid!, -4, 0)?.obstacle).toBe(false);
    expect(cellAt(s.priorGrid!, -11, 9)?.valid).toBe(true);
    expect(cellAt(s.grid, -4, 0)?.obstacle).toBe(true);
  });
});
describe("generic collision builder", () => {
  it("selects the highest downward hit and conservatively marks thin obstacles", () => {
    const layout: Layout = {
      path: "grid.json",
      origin: [0, 0],
      cell_size: 1,
      dimensions: [2, 2],
      encoding: "json-row-major-v1",
    };
    const tri = (y: number) => ({
      points: [
        [0, y, 0],
        [4, y, 0],
        [0, y, 4],
      ] as [Vec3, Vec3, Vec3],
      provenance: "ORBITAL" as const,
      obstacle: false,
    });
    const g = rasterize(
      [
        tri(0),
        tri(2),
        {
          points: [
            [0.01, 0, 0],
            [0.01, 2, 0],
            [0.01, 0, 1],
          ],
          provenance: "UNKNOWN",
          obstacle: true,
        },
      ],
      layout,
    );
    expect(g.height[0]).toBe(2);
    expect(g.obstacle[0]).toBe(1);
    expect(g.provenance[0]).toBe("ORBITAL");
  });
  it("applies node transforms and rejects unnamed meshes", async () => {
    const temp = await mkdtemp(join(tmpdir(), "astra-geometry-"));
    try {
      const doc = new Document(),
        buffer = doc.createBuffer(),
        a = doc
          .createAccessor()
          .setType("VEC3")
          .setArray(new Float32Array([0, 0, 0, 2, 0, 0, 0, 0, 2]))
          .setBuffer(buffer),
        node = doc
          .createNode("ground_ORBITAL")
          .setTranslation([3, 4, 5])
          .setMesh(
            doc
              .createMesh()
              .addPrimitive(doc.createPrimitive().setAttribute("POSITION", a)),
          );
      doc.createScene().addChild(node);
      const file = join(temp, "collision.glb");
      await new NodeIO().write(file, doc);
      expect((await collisionTriangles(file))[0].points[0]).toEqual([3, 4, 5]);
      node.setName("mystery");
      await new NodeIO().write(file, doc);
      await expect(collisionTriangles(file)).rejects.toThrow("Unclassified");
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
  it("runs unchanged on a copied scene directory and reproduces grids", async () => {
    const temp = await mkdtemp(join(tmpdir(), "astra-rebuild-"));
    try {
      await cp(dir, temp, { recursive: true });
      await buildGroundGrid(temp);
      expect(
        JSON.parse(await readFile(join(temp, "ground_grid.json"), "utf8")),
      ).toEqual(s.grid);
      expect(
        JSON.parse(
          await readFile(join(temp, "prior_ground_grid.json"), "utf8"),
        ),
      ).toEqual(s.priorGrid);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
});
