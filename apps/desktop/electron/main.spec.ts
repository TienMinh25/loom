import { expect, test } from "bun:test";
import { join } from "node:path";
import { getWindowPolicy, getPreloadPath } from "./windowPolicy";

test("desktop window keeps renderer isolation enabled and loads a CJS preload", () => {
  expect(getWindowPolicy()).toEqual({
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  });
  expect(getPreloadPath(join("app", "dist-electron"))).toBe(
    join("app", "dist-electron", "preload.cjs"),
  );
});

test("sandbox preload is bundled as CommonJS for Electron", async () => {
  const result = await Bun.build({
    entrypoints: ["electron/preload.ts"],
    target: "node",
    format: "cjs",
    external: ["electron"],
  });
  expect(result.success).toBe(true);
  const source = await result.outputs[0].text();
  expect(source.includes('require("electron")')).toBe(true);
  expect(source.includes("import { contextBridge }")).toBe(false);
});
