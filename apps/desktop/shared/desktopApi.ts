export const DESKTOP_API_VERSION = 1;

export const WORKSPACE_CHANNELS = {
  open: "workspace:v1:open",
  create: "workspace:v1:create",
  list: "workspace:v1:list",
  gitStatus: "workspace:v1:git-status",
  readFile: "workspace:v1:read-file",
  writeFile: "workspace:v1:write-file",
  createFile: "workspace:v1:create-file",
  createDirectory: "workspace:v1:create-directory",
  delete: "workspace:v1:delete",
  rename: "workspace:v1:rename",
} as const;

export const AGENT_CHANNELS = {
  loadConfig: "agent:v1:load-config",
  configure: "agent:v1:configure",
  stream: "agent:v1:stream",
  cancel: "agent:v1:cancel",
  respondApproval: "agent:v1:respond-approval",
  event: "agent:v1:event",
} as const;

export type AgentProviderConfig = { baseUrl: string; apiKey: string; model: string };
export type AgentMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
};
export type AgentApprovalRequest = { id: string; toolName: string; arguments: unknown };
export type AgentStreamUpdate = {
  content?: string;
  done?: boolean;
  error?: string;
  approval?: AgentApprovalRequest;
};

export type DesktopAgentApi = {
  loadConfig(): Promise<Omit<AgentProviderConfig, "apiKey"> & { configured: boolean }>;
  configure(config: AgentProviderConfig): Promise<{ configured: boolean; model: string }>;
  stream: (
    runId: string,
    request: { model: string; messages: AgentMessage[] },
    onUpdate: (update: AgentStreamUpdate) => void,
  ) => Promise<void>;
  cancel(runId: string): Promise<{ cancelled: boolean }>;
  respondApproval(approvalId: string, approved: boolean): Promise<{ accepted: boolean }>;
};

export type WorkspaceEntry = {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
};

export type WorkspaceRoot = { root: string };

export type DesktopWorkspaceApi = {
  open(): Promise<WorkspaceRoot | null>;
  create?(name: string): Promise<WorkspaceRoot | null>;
  list(path: string): Promise<WorkspaceEntry[]>;
  gitStatus?(): Promise<{ isGit: boolean; branch: string }>;
  readFile(path: string): Promise<{ content: string }>;
  writeFile(path: string, content: string): Promise<{ written: boolean }>;
  createFile(path: string): Promise<{ created: boolean }>;
  createDirectory(path: string): Promise<{ created: boolean }>;
  delete(path: string): Promise<{ deleted: boolean }>;
  rename(from: string, to: string): Promise<{ renamed: boolean }>;
};

export type DesktopApi = {
  version: typeof DESKTOP_API_VERSION;
  platform: string;
  onMenuAction?(callback: (action: string, value?: boolean) => void): () => void;
  setAutoSaveState?(enabled: boolean): void;
  workspace: DesktopWorkspaceApi;
  agent: DesktopAgentApi;
};
