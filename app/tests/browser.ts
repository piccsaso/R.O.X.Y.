import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const output = new URL("../verification/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const origin = process.env.APP_URL ?? "http://localhost:5173";
await page.goto(origin + "/?scene=test_scene&test=1");
await page.waitForFunction(() => !!(window as any).__walker?.ready);
await page.screenshot({ path: fileURLToPath(new URL("entry.png", output)) });
await page.click("#enter");
await page.waitForFunction(() => !!document.pointerLockElement);
await page.locator("#entry").waitFor({ state: "hidden" });
assert.equal(await page.locator("[data-region]").count(), 6);
assert.equal(await page.locator("#test-data").isVisible(), true);
const results: unknown[] = [];
for (const [name, x, z, heading] of [
  ["boulder", -8, 0, 90],
  ["hole", -16, 9, 90],
  ["ledge ascent", 18, 5, 180],
  ["ledge descent", 18, 9, 0],
  ["steep band", 6, -12, 90],
  ["boundary", 28, 0, 90],
] as const) {
  await page.evaluate(
    ({ x, z, heading }) => {
      const w = (window as any).__walker,
        g = w.scene.grid,
        i = Math.floor((x - g.origin[0]) / g.cell_size),
        j = Math.floor((z - g.origin[1]) / g.cell_size);
      w.set({
        x,
        z,
        y: g.height[j * g.dimensions[0] + i],
        heading,
        blocked: null,
        warning: null,
      });
    },
    { x, z, heading },
  );
  await page.keyboard.down("KeyW");
  await page.waitForFunction(
    () => !!(window as any).__walker.get().blocked,
    {},
    { timeout: 10000 },
  );
  const stop = await page.evaluate(() => (window as any).__walker.get());
  await page.waitForTimeout(350);
  const held = await page.evaluate(() => (window as any).__walker.get());
  assert.ok(
    Math.hypot(stop.x - held.x, stop.z - held.z) <= 0.0625,
    "No movement beyond one sweep substep at the blocking edge",
  );
  assert.ok(held.blocked);
  await page.screenshot({
    path: fileURLToPath(new URL(name.replaceAll(" ", "-") + ".png", output)),
  });
  await page.keyboard.up("KeyW");
  results.push({
    name,
    start: { x, z, heading },
    stop: held,
    remainedBlocked: true,
  });
  console.log("PASS browser " + name + ": " + JSON.stringify(stop));
}
await page.keyboard.press("KeyR");
const reset = await page.evaluate(() => (window as any).__walker.get());
assert.equal(reset.x, -22);
assert.equal(reset.z, 0);
await page.mouse.move(800, 450);
await page.mouse.move(1000, 500);
await page.waitForTimeout(100);
const looked = await page.evaluate(() => (window as any).__walker.get());
assert.notEqual(looked.heading, 90);
await page.keyboard.press("KeyR");
// No runtime network dependency after initial assets load.
await page.context().setOffline(true);
await page.keyboard.down("KeyW");
await page.waitForTimeout(700);
await page.keyboard.up("KeyW");
const offline = await page.evaluate(() => (window as any).__walker.get());
assert.ok(offline.x > -22);
assert.equal(offline.blocked, null);
await page.screenshot({
  path: fileURLToPath(new URL("walk-offline.png", output)),
});
await page.context().setOffline(false);
await page.keyboard.press("Escape");
await page.waitForFunction(() => !document.pointerLockElement);
await page.locator("#entry").waitFor({ state: "visible" });
assert.deepEqual(errors, []);
await writeFile(
  new URL("browser-results.json", output),
  JSON.stringify(
    {
      origin,
      testedAt: new Date().toISOString(),
      browser: "Chromium",
      headless: true,
      viewport: "1440x900",
      tests: results,
      pointerLock: true,
      mouseLook: true,
      reset: true,
      offlineWalking: true,
      hudRegions: 6,
      watermark: true,
      errors,
    },
    null,
    2,
  ),
);
console.log(
  "PASS pointer lock, mouse look, reset, offline walking, six HUD regions, TEST DATA; no page errors",
);
await browser.close();
