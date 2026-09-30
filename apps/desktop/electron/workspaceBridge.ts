export type WorkspaceEntry = {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
};

export type WorkspaceRoot = { root: string };

export type WorkspaceRuntime = {
  request<Result>(method: string, params: unknown): Promise<Result>;
};

export type DirectoryPicker = (intent: "open" | "create") => Promise<string | null>;

export function createWorkspaceBridge(runtime: WorkspaceRuntime, pickDirectory: DirectoryPicker) {
  return {
    async openWorkspace(): Promise<WorkspaceRoot | null> {
      const root = await pickDirectory("open");
      if (!root) {
        return null;
      }
      return runtime.request<WorkspaceRoot>("workspace.open", { root });
    },

    async createWorkspace(name: string): Promise<WorkspaceRoot | null> {
      const parent = await pickDirectory("create");
      if (!parent) {
        return null;
      }
      return runtime.request<WorkspaceRoot>("workspace.createRoot", { parent, name });
    },

    list(path: string): Promise<WorkspaceEntry[]> {
      return runtime.request<WorkspaceEntry[]>("workspace.list", { path });
    },

    gitStatus(): Promise<{ isGit: boolean; branch: string }> {
      return runtime.request<{ isGit: boolean; branch: string }>("workspace.gitStatus", {});
    },

    readFile(path: string): Promise<{ content: string }> {
      return runtime.request<{ content: string }>("workspace.readFile", { path });
    },

    writeFile(path: string, content: string): Promise<{ written: boolean }> {
      return runtime.request<{ written: boolean }>("workspace.writeFile", { path, content });
    },

    createFile(path: string): Promise<{ created: boolean }> {
      return runtime.request<{ created: boolean }>("workspace.createFile", { path });
    },

    createDirectory(path: string): Promise<{ created: boolean }> {
      return runtime.request<{ created: boolean }>("workspace.createDirectory", { path });
    },

    delete(path: string): Promise<{ deleted: boolean }> {
      return runtime.request<{ deleted: boolean }>("workspace.delete", { path });
    },

    rename(from: string, to: string): Promise<{ renamed: boolean }> {
      return runtime.request<{ renamed: boolean }>("workspace.rename", { from, to });
    },
  };
}
