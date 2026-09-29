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

export type DirectoryPicker = () => Promise<string | null>;

export function createWorkspaceBridge(runtime: WorkspaceRuntime, pickDirectory: DirectoryPicker) {
  return {
    async openWorkspace(): Promise<WorkspaceRoot | null> {
      const root = await pickDirectory();
      if (!root) {
        return null;
      }
      return runtime.request<WorkspaceRoot>("workspace.open", { root });
    },

    list(path: string): Promise<WorkspaceEntry[]> {
      return runtime.request<WorkspaceEntry[]>("workspace.list", { path });
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
  };
}
