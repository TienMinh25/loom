import { join } from "node:path";

export function getWindowPolicy() {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  } as const;
}

export function getPreloadPath(directory: string) {
  return join(directory, "preload.cjs");
}
