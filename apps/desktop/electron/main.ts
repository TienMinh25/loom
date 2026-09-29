import { app, BrowserWindow, dialog, ipcMain, safeStorage } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { PathLike, WriteFileOptions } from "node:fs";
import { join } from "node:path";
import { getPreloadPath, getWindowPolicy } from "./windowPolicy.js";
import { getTrustedRendererUrl, isTrustedRendererUrl } from "./navigationPolicy.js";
import { startRuntime } from "./runtimeProcess.js";
import { createWorkspaceBridge } from "./workspaceBridge.js";
import { createAgentBridge } from "./agentBridge.js";
import { createProviderConfigStore } from "./providerConfigStore.js";
import { AGENT_CHANNELS, WORKSPACE_CHANNELS } from "../shared/desktopApi.js";

let mainWindow: BrowserWindow | null = null;
let runtime: ReturnType<typeof startRuntime> | null = null;

function getRuntime() {
  runtime ??= startRuntime(import.meta.dirname, app.isPackaged);
  return runtime;
}

const workspaceBridge = createWorkspaceBridge(
  { request: (method, params) => getRuntime().request(method, params) },
  async () => {
    if (!mainWindow) {
      throw new Error("desktop window is not available");
    }
    const selection = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });
    return selection.canceled ? null : (selection.filePaths[0] ?? null);
  },
);
const agentBridge = createAgentBridge({
  request: (method, params) => getRuntime().request(method, params),
  stream: (method, params, onEvent) => getRuntime().stream(method, params, onEvent),
});
const providerConfigStore = createProviderConfigStore(
  join(app.getPath("userData"), "provider-config.json"),
  safeStorage,
  {
    readFile: (path: PathLike, encoding: "utf8") => readFile(path, encoding),
    async writeFile(path: PathLike, content: string, options?: WriteFileOptions) {
      await mkdir(app.getPath("userData"), { recursive: true });
      await writeFile(path, content, options);
    },
  },
);

ipcMain.handle(WORKSPACE_CHANNELS.open, () => workspaceBridge.openWorkspace());
ipcMain.handle(WORKSPACE_CHANNELS.list, (_event, path: string) => workspaceBridge.list(path));
ipcMain.handle(WORKSPACE_CHANNELS.readFile, (_event, path: string) =>
  workspaceBridge.readFile(path),
);
ipcMain.handle(WORKSPACE_CHANNELS.writeFile, (_event, path: string, content: string) =>
  workspaceBridge.writeFile(path, content),
);
ipcMain.handle(WORKSPACE_CHANNELS.createFile, (_event, path: string) =>
  workspaceBridge.createFile(path),
);
ipcMain.handle(WORKSPACE_CHANNELS.createDirectory, (_event, path: string) =>
  workspaceBridge.createDirectory(path),
);
ipcMain.handle(WORKSPACE_CHANNELS.delete, (_event, path: string) => workspaceBridge.delete(path));
ipcMain.handle(AGENT_CHANNELS.loadConfig, async () => {
  const config = await providerConfigStore.load();
  if (config.configured) {
    await providerConfigStore.restore((secret) => agentBridge.configure(secret));
  }
  return config;
});
ipcMain.handle(AGENT_CHANNELS.configure, async (_event, config) =>
  providerConfigStore.configure(config, (secret) => agentBridge.configure(secret)),
);
ipcMain.handle(AGENT_CHANNELS.cancel, (_event, runId: string) => agentBridge.cancel(runId));
ipcMain.handle(AGENT_CHANNELS.respondApproval, (_event, approvalId: string, approved: boolean) =>
  agentBridge.respondApproval(approvalId, approved),
);
ipcMain.handle(AGENT_CHANNELS.stream, (event, runId: string, request) =>
  agentBridge.stream(runId, request, (update) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send(AGENT_CHANNELS.event, { runId, update });
    }
  }),
);

function createMainWindow() {
  const developmentUrl = process.env.VITE_DEV_SERVER_URL;
  const packagedUrl = getTrustedRendererUrl(import.meta.dirname, !developmentUrl);
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#111318",
    webPreferences: {
      ...getWindowPolicy(),
      preload: getPreloadPath(import.meta.dirname),
    },
  });
  mainWindow = window;

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedRendererUrl(url, developmentUrl, packagedUrl)) {
      event.preventDefault();
    }
  });

  if (developmentUrl) {
    void window.loadURL(developmentUrl);
  } else {
    void window.loadFile(join(import.meta.dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("will-quit", () => {
  runtime?.dispose();
  runtime = null;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
