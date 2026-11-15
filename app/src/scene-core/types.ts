export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Provenance =
  "ROVER_MEASURED" | "ROVER_STEREO" | "ORBITAL" | "INTERPOLATED" | "UNKNOWN";
export interface Layout {
  path: string;
  cell_size: number;
  origin: Vec2;
  dimensions: Vec2;
  encoding: "json-row-major-v1";
}
export interface Grid extends Layout {
  schema_version: "1.0.0";
  height: (number | null)[];
  provenance: Provenance[];
  valid: number[];
  obstacle: number[];
}
export interface Landmark {
  id: string;
  display_name: string;
  aliases: string[];
  kind: string;
  position: Vec3 | null;
  position_status: "VERIFIED" | "ESTIMATED" | "UNKNOWN";
  scene_status:
    | "IN_SCENE_REACHABLE"
    | "IN_SCENE_BLOCKED_TARGET"
    | "OUTSIDE_PATCH"
    | "POSITION_UNVERIFIED";
  viewing_points: { id: string; position: Vec3; facing: number }[];
  science: {
    description: string;
    instruments: string[];
    products: string[];
    sol: number | null;
    site_drive: string | null;
    data_class: string;
    photo?: {
      path: string;
      image_id: string;
      sol: number;
      camera: string;
      credit: string;
      source_url: string;
    };
  };
  sources: unknown[];
}
export interface SceneManifest {
  schema_version: "1.0.0";
  scene_id: string;
  title: string;
  is_test_data: boolean;
  units: "metres";
  axes: string;
  origin: { description: string; site_frame: string | null };
  map_transform: {
    status: "VERIFIED" | "ESTIMATED" | "NONE";
    reference_body?: "Mars";
    datum?: string;
    latitude?: number;
    longitude?: number;
    radius_m?: number;
    error_m?: number;
  };
  playable_bounds: Vec2[];
  spawn: { position: Vec3; heading: number; eye_height: number };
  terrain: string;
  collision: string;
  prior_collision?: string;
  landmarks: string;
  ground_grid: Layout;
  prior_ground_grid?: Layout;
  overlays: ({
    id: string;
    path: string;
    format: string;
    bounds?: number[];
    value_range?: Vec2;
  } & Record<string, unknown>)[];
  routes: { id: string; path: string }[];
  credits: unknown[];
}
export interface ScenePackage {
  manifest: SceneManifest;
  landmarks: Landmark[];
  grid: Grid;
  priorGrid?: Grid;
}
