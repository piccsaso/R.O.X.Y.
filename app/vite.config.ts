import { defineConfig } from "vite";
import { readFile, cp } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
const scenes = resolve(import.meta.dirname, "../scenes");
export default defineConfig({
  plugins: [
    {
      name: "scene-packages",
      configureServer(server) {
        server.middlewares.use("/scenes", async (req, res, next) => {
          try {
            const pathname = decodeURIComponent((req.url ?? "").split("?")[0]),
              file = resolve(scenes, "." + pathname);
            if (!file.startsWith(scenes + sep)) {
              res.statusCode = 403;
              res.end();
              return;
            }
            const contents = await readFile(file);
            res.setHeader(
              "Content-Type",
              (
                {
                  ".json": "application/json",
                  ".glb": "model/gltf-binary",
                  ".png": "image/png",
                  ".geojson": "application/geo+json",
                } as Record<string, string>
              )[extname(file)] ?? "application/octet-stream",
            );
            res.end(contents);
          } catch {
            next();
          }
        });
      },
      async closeBundle() {
        await cp(scenes, resolve(import.meta.dirname, "dist/scenes"), {
          recursive: true,
        });
      },
    },
  ],
  test: { include: ["tests/**/*.test.ts"], testTimeout: 30000 },
} as Parameters<typeof defineConfig>[0]);
