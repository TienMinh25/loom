import { contextBridge, ipcRenderer } from "electron";
import { AGENT_CHANNELS, DESKTOP_API_VERSION, WORKSPACE_CHANNELS } from "../shared/desktopApi";

contextBridge.exposeInMainWorld("loomDesktop", {
  version: DESKTOP_API_VERSION,
  platform: process.platform,
  onMenuAction: (callback: (action: string, value?: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: string, value?: boolean) =>
      callback(action, value);
    ipcRenderer.on("app:menu", listener);
    return () => ipcRenderer.removeListener("app:menu", listener);
  },
  setAutoSaveState: (enabled: boolean) => ipcRenderer.send("app:auto-save-state", enabled),
  workspace: {
    open: () => ipcRenderer.invoke(WORKSPACE_CHANNELS.open),
    create: (name: string) => ipcRenderer.invoke(WORKSPACE_CHANNELS.create, name),
    list: (path: string) => ipcRenderer.invoke(WORKSPACE_CHANNELS.list, path),
    gitStatus: () => ipcRenderer.invoke(WORKSPACE_CHANNELS.gitStatus),
    readFile: (path: string) => ipcRenderer.invoke(WORKSPACE_CHANNELS.readFile, path),
    writeFile: (path: string, content: string) =>
      ipcRenderer.invoke(WORKSPACE_CHANNELS.writeFile, path, content),
    createFile: (path: string) => ipcRenderer.invoke(WORKSPACE_CHANNELS.createFile, path),
    createDirectory: (path: string) => ipcRenderer.invoke(WORKSPACE_CHANNELS.createDirectory, path),
    delete: (path: string) => ipcRenderer.invoke(WORKSPACE_CHANNELS.delete, path),
    rename: (from: string, to: string) => ipcRenderer.invoke(WORKSPACE_CHANNELS.rename, from, to),
  },
  agent: {
    loadConfig: () => ipcRenderer.invoke(AGENT_CHANNELS.loadConfig),
    configure: (config: { baseUrl: string; apiKey: string; model: string }) =>
      ipcRenderer.invoke(AGENT_CHANNELS.configure, config),
    cancel: (runId: string) => ipcRenderer.invoke(AGENT_CHANNELS.cancel, runId),
    respondApproval: (approvalId: string, approved: boolean) =>
      ipcRenderer.invoke(AGENT_CHANNELS.respondApproval, approvalId, approved),
    stream: (
      runId: string,
      request: {
        model: string;
        messages: {
          role: "system" | "user" | "assistant" | "tool";
          content: string;
          tool_call_id?: string;
          name?: string;
          tool_calls?: {
            id: string;
            type: string;
            function: { name: string; arguments: string };
          }[];
        }[];
      },
      onUpdate: (update: {
        content?: string;
        done?: boolean;
        error?: string;
        approval?: { id: string; toolName: string; arguments: unknown };
      }) => void,
    ) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: {
          runId: string;
          update: {
            content?: string;
            done?: boolean;
            error?: string;
            approval?: { id: string; toolName: string; arguments: unknown };
          };
        },
      ) => {
        if (payload.runId === runId) {
          onUpdate(payload.update);
        }
      };
      ipcRenderer.on(AGENT_CHANNELS.event, listener);
      return ipcRenderer
        .invoke(AGENT_CHANNELS.stream, runId, request)
        .finally(() => ipcRenderer.removeListener(AGENT_CHANNELS.event, listener));
    },
  },
});
