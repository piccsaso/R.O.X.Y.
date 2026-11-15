import { buildGroundGrid } from "../../app/src/build/grid";
const dir = process.argv[2];
if (!dir) throw new Error("Usage: npm run grid -- ../scenes/<scene_id>");
await buildGroundGrid(dir);
