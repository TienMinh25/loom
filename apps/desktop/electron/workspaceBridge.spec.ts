import { expect, test } from "bun:test";
import { createWorkspaceBridge, type WorkspaceRuntime } from "./workspaceBridge";

class FakeRuntime implements WorkspaceRuntime {
  requests: { method: string; params: unknown }[] = [];

  async request<Result>(method: string, params: unknown): Promise<Result> {
    this.requests.push({ method, params });
    return { root: "C:/selected-project" } as Result;
  }
}

test("workspace bridge opens only the directory selected by the native picker", async () => {
  const runtime = new FakeRuntime();
  const bridge = createWorkspaceBridge(runtime, async () => "C:/selected-project");

  expect(await bridge.openWorkspace()).toEqual({ root: "C:/selected-project" });
  expect(runtime.requests).toEqual([
    { method: "workspace.open", params: { root: "C:/selected-project" } },
  ]);
});

test("workspace bridge does not open a root when the folder picker is cancelled", async () => {
  const runtime = new FakeRuntime();
  const bridge = createWorkspaceBridge(runtime, async () => null);

  expect(await bridge.openWorkspace()).toBeNull();
  expect(runtime.requests).toEqual([]);
});

test("workspace bridge routes tree, read, create and write calls through the scoped runtime", async () => {
  const runtime = new FakeRuntime();
  const bridge = createWorkspaceBridge(runtime, async () => "C:/selected-project");
  await bridge.list("src");
  await bridge.readFile("src/main.ts");
  await bridge.writeFile("src/main.ts", "export const ready = true;");
  await bridge.createFile("src/new.ts");
  await bridge.createDirectory("src/components");
  await bridge.delete("src/main.ts");

  expect(runtime.requests).toEqual([
    { method: "workspace.list", params: { path: "src" } },
    { method: "workspace.readFile", params: { path: "src/main.ts" } },
    {
      method: "workspace.writeFile",
      params: { path: "src/main.ts", content: "export const ready = true;" },
    },
    { method: "workspace.createFile", params: { path: "src/new.ts" } },
    { method: "workspace.createDirectory", params: { path: "src/components" } },
    { method: "workspace.delete", params: { path: "src/main.ts" } },
  ]);
});
