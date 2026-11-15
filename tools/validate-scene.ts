import { validateSceneDirectory } from "../app/src/build/validate";
if (!process.argv[2])
  throw new Error("Usage: npm run validate -- ../scenes/<scene_id>");
await validateSceneDirectory(process.argv[2]);
