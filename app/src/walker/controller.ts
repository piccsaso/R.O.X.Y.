import defaults from "../../../config/navigation.json";
import {
  cellAt,
  groundHeight,
  groundNormal,
  insidePolygon,
} from "../scene-core";
import type { ScenePackage, Vec2 } from "../scene-core";
export const navigation = defaults;
export type Navigation = typeof defaults;
export interface WalkerState {
  x: number;
  y: number;
  z: number;
  heading: number;
  blocked: string | null;
  warning: string | null;
}
export function resetWalker(s: ScenePackage): WalkerState {
  const [x, , z] = s.manifest.spawn.position;
  return {
    x,
    y: groundHeight(s.grid, x, z)!,
    z,
    heading: s.manifest.spawn.heading,
    blocked: null,
    warning: null,
  };
}
function segmentDistance(p: Vec2, a: Vec2, b: Vec2) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    d = dx * dx + dz * dz,
    t = d
      ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / d))
      : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}
export function checkPosition(
  s: ScenePackage,
  x: number,
  z: number,
  c: Navigation = defaults,
): string | null {
  const { grid: g, manifest: m } = s,
    r = c.player_radius_m.value + c.safety_margin_m.value;
  if (
    !insidePolygon([x, z], m.playable_bounds) ||
    m.playable_bounds.some(
      (a, i) =>
        segmentDistance(
          [x, z],
          a,
          m.playable_bounds[(i + 1) % m.playable_bounds.length],
        ) < r,
    )
  )
    return "boundary";
  const center = cellAt(g, x, z);
  if (!center?.valid) return "hole";
  const cell = g.cell_size,
    [ox, oz] = g.origin,
    [w, d] = g.dimensions;
  for (
    let j = Math.floor((z - r - oz) / cell);
    j <= Math.floor((z + r - oz) / cell);
    j++
  )
    for (
      let i = Math.floor((x - r - ox) / cell);
      i <= Math.floor((x + r - ox) / cell);
      i++
    ) {
      const minX = ox + i * cell,
        minZ = oz + j * cell;
      if (
        Math.hypot(
          Math.max(minX - x, 0, x - minX - cell),
          Math.max(minZ - z, 0, z - minZ - cell),
        ) > r
      )
        continue;
      if (i < 0 || j < 0 || i >= w || j >= d) return "boundary";
      const k = j * w + i;
      if (!g.valid[k]) return "hole";
      if (g.obstacle[k]) return "obstacle";
      if (
        g.provenance[k] === "UNKNOWN" ||
        (!c.allow_interpolated.value && g.provenance[k] === "INTERPOLATED")
      )
        return "provenance";
      // Adjacent-cell discontinuities are evaluated throughout the body footprint.
      for (const [di, dj] of [
        [1, 0],
        [0, 1],
      ]) {
        const ni = i + di,
          nj = j + dj;
        if (ni < w && nj < d) {
          const nk = nj * w + ni;
          if (
            g.valid[nk] &&
            Math.abs(g.height[k]! - g.height[nk]!) > c.max_step_m.value
          )
            return "ledge";
        }
      }
      const n = groundNormal(
        g,
        minX + cell / 2,
        minZ + cell / 2,
        c.slope_baseline_m.value,
      );
      if (
        n &&
        (Math.acos(Math.max(-1, Math.min(1, n[1]))) * 180) / Math.PI >
          c.max_slope_deg.value
      )
        return "slope";
    }
  return null;
}
/** Pure swept controller: world-space requested displacement, independent of renderer/time. */
export function moveWalker(
  s: ScenePackage,
  state: WalkerState,
  dx: number,
  dz: number,
  c: Navigation = defaults,
): WalkerState {
  if (!Number.isFinite(dx) || !Number.isFinite(dz))
    throw new Error("Non-finite movement");
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(dx, dz) / (s.grid.cell_size / 4)),
  );
  let next = {
    ...state,
    blocked: null as string | null,
    warning: null as string | null,
  };
  for (let k = 0; k < steps; k++) {
    const x = next.x + dx / steps,
      z = next.z + dz / steps,
      reason = checkPosition(s, x, z, c);
    if (reason) return { ...next, blocked: reason };
    const y = groundHeight(s.grid, x, z)!;
    if (Math.abs(y - next.y) > c.max_step_m.value)
      return { ...next, blocked: "ledge" };
    next = { ...next, x, y, z };
    if (cellAt(s.grid, x, z)?.provenance === "INTERPOLATED")
      next.warning = "INTERPOLATED ground";
  }
  return next;
}
export function tickWalker(
  s: ScenePackage,
  state: WalkerState,
  input: { forward: number; right: number; heading: number },
  dt: number,
  c: Navigation = defaults,
) {
  const h = (input.heading * Math.PI) / 180,
    scale =
      (c.speed_m_s.value * Math.min(c.max_frame_s.value, Math.max(0, dt))) /
      Math.max(1, Math.hypot(input.forward, input.right));
  return moveWalker(
    s,
    { ...state, heading: input.heading },
    (Math.sin(h) * input.forward + Math.cos(h) * input.right) * scale,
    (-Math.cos(h) * input.forward + Math.sin(h) * input.right) * scale,
    c,
  );
}
