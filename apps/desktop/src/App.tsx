import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpOutlined,
  StopOutlined,
  CloseOutlined,
  CodeOutlined,
  FileOutlined,
  FolderOutlined,
  MessageOutlined,
  MoonOutlined,
  SunOutlined,
} from "@ant-design/icons";
import {
  Button,
  ConfigProvider,
  Drawer,
  Dropdown,
  Input,
  Layout,
  Modal,
  Space,
  Switch,
  Tabs,
  Tag,
  Typography,
  theme,
} from "antd";
import type { ApprovalState, Conversation } from "./types/conversation";
import { loadConversationState, saveConversationState } from "./conversationStorage";
import type { AgentApprovalRequest } from "../shared/desktopApi";
import { ConversationSidebar } from "./components/ConversationSidebar";
import { WorkspaceExplorer } from "./components/WorkspaceExplorer";
import { ComposerControls } from "./components/ComposerControls";
import { getApprovalPreviewState, type ApprovalMode } from "./approvalMode";
import type { DataNode } from "antd/es/tree";
import type { WorkspaceEntry } from "../shared/desktopApi";
import { ResizablePanelShell } from "./components/ResizablePanelShell";
import "./App.css";

const { Content } = Layout;
const { Text, Title } = Typography;
const THEME_STORAGE_KEY = "loom:theme:v1";
const AUTO_SAVE_STORAGE_KEY = "loom:auto-save:v1";
const LEFT_PANEL_OPEN_KEY = "loom:left-panel-open:v1";
const RIGHT_PANEL_OPEN_KEY = "loom:right-panel-open:v1";
const MAX_EDITOR_FILE_BYTES = 50 * 1024 * 1024;
type WorkspaceFile = {
  path: string;
  size?: number;
  content?: string;
  draftContent?: string;
  isDir?: boolean;
  file?: File;
};
type OpenFile = { path: string; content: string; dirty: boolean };

function makeWorkspaceTree(files: WorkspaceFile[]): DataNode[] {
  const root: DataNode[] = [];
  const nodes = new Map<string, DataNode>();

  for (const file of files) {
    const parts = file.path.split(/[\\/]/).filter(Boolean);
    let children = root;
    let path = "";

    parts.forEach((part, index) => {
      path = path ? `${path}/${part}` : part;
      let node = nodes.get(path);
      const isDirectory = index < parts.length - 1 || file.isDir === true;
      if (!node) {
        node = {
          key: path,
          title: part,
          icon: isDirectory ? <FolderOutlined /> : <FileOutlined />,
          isLeaf: !isDirectory,
          children: isDirectory ? [] : undefined,
        };
        children.push(node);
        nodes.set(path, node);
      }
      children = node.children ?? [];
    });
  }

  return root;
}

function App() {
  const [prompt, setPrompt] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>(
    () => loadConversationState(localStorage).conversations,
  );
  const [activeConversationId, setActiveConversationId] = useState(
    () => loadConversationState(localStorage).activeConversationId,
  );
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<"dark" | "light">(() =>
    localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark",
  );
  const [conversationSidebarOpen, setConversationSidebarOpen] = useState(
    () => localStorage.getItem(LEFT_PANEL_OPEN_KEY) !== "false",
  );
  const [workspaceExplorerOpen, setWorkspaceExplorerOpen] = useState(
    () => localStorage.getItem(RIGHT_PANEL_OPEN_KEY) !== "false",
  );
  const [createFileOpen, setCreateFileOpen] = useState(false);
  const [createDirectoryOpen, setCreateDirectoryOpen] = useState(false);
  const [newFilePath, setNewFilePath] = useState("");
  const [newDirectoryPath, setNewDirectoryPath] = useState("");
  const [deletePath, setDeletePath] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [gatewayConnected, setGatewayConnected] = useState(false);
  const [gatewayBaseUrl, setGatewayBaseUrl] = useState("http://localhost:1234/v1");
  const [gatewayApiKey, setGatewayApiKey] = useState("");
  const [gatewayModel, setGatewayModel] = useState("gpt-4o-mini");
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<{
    conversationId: string;
    request: AgentApprovalRequest;
  } | null>(null);
  const pendingApprovalRef = useRef<{
    conversationId: string;
    request: AgentApprovalRequest;
  } | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [closeFilePrompt, setCloseFilePrompt] = useState<OpenFile | null>(null);
  const [autoSaveFiles, setAutoSaveFiles] = useState(
    () => localStorage.getItem(AUTO_SAVE_STORAGE_KEY) === "true",
  );
  const [activeTab, setActiveTab] = useState("chat");
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>("ask");
  const [selectedModel, setSelectedModel] = useState("Gateway model");
  const [reasoningLevel, setReasoningLevel] = useState("medium");
  const [extensionDialog, setExtensionDialog] = useState<"plugin" | "mcp" | null>(null);
  const [extensionName, setExtensionName] = useState("");
  const [extensions, setExtensions] = useState<string[]>([]);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const editorGutterRef = useRef<HTMLDivElement>(null);
  const startNewConversation = useCallback(() => {
    const current = conversations.find((conversation) => conversation.id === activeConversationId);
    if (!current || current.messages.length === 0) return;
    const conversation: Conversation = {
      id: crypto.randomUUID(),
      title: "New conversation",
      messages: [],
      approvalState: "hidden",
    };
    setConversations((current) => [conversation, ...current]);
    setActiveConversationId(conversation.id);
  }, [activeConversationId, conversations]);

  function deleteConversation() {
    if (!conversationToDelete) return;
    const remaining = conversations.filter(
      (conversation) => conversation.id !== conversationToDelete,
    );
    const next =
      remaining.length > 0
        ? remaining
        : [{ id: crypto.randomUUID(), title: "New conversation", messages: [] }];
    setConversations(next);
    if (conversationToDelete === activeConversationId) setActiveConversationId(next[0].id);
    setConversationToDelete(null);
  }

  const openWorkspacePicker = useCallback(async () => {
    const desktop = window.loomDesktop;
    if (!desktop || desktop.version !== 1) {
      directoryInputRef.current?.click();
      return;
    }

    try {
      const opened = await desktop.workspace.open();
      if (!opened) {
        return;
      }
      const entries = await desktop.workspace.list(".");
      setWorkspaceRoot(opened.root);
      setWorkspaceFiles(
        entries.map((entry) => ({ path: entry.path, isDir: entry.isDir, size: entry.size })),
      );
      setOpenFiles([]);
      setActiveTab("chat");
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Could not open workspace");
    }
  }, []);

  useEffect(() => {
    const desktop = window.loomDesktop;
    if (!desktop || desktop.version !== 1 || !desktop.agent) {
      return;
    }
    void desktop.agent
      .loadConfig()
      .then((config) => {
        setGatewayBaseUrl(config.baseUrl);
        setGatewayModel(config.model);
        setGatewayConnected(config.configured);
        setSelectedModel(config.model || "gpt-4o-mini");
      })
      .catch((error: unknown) =>
        setGatewayError(
          error instanceof Error ? error.message : "Could not load provider settings",
        ),
      );
  }, []);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem(AUTO_SAVE_STORAGE_KEY, String(autoSaveFiles));
  }, [autoSaveFiles]);

  useEffect(() => {
    saveConversationState(localStorage, { conversations, activeConversationId });
  }, [conversations, activeConversationId]);

  useEffect(() => {
    localStorage.setItem(LEFT_PANEL_OPEN_KEY, String(conversationSidebarOpen));
  }, [conversationSidebarOpen]);
  useEffect(() => {
    localStorage.setItem(RIGHT_PANEL_OPEN_KEY, String(workspaceExplorerOpen));
  }, [workspaceExplorerOpen]);

  useEffect(() => {
    function handleSaveShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") {
        return;
      }
      const file = openFiles.find((entry) => entry.path === activeTab);
      if (!file?.dirty) {
        return;
      }
      event.preventDefault();
      const desktop = window.loomDesktop;
      if (!desktop || desktop.version !== 1 || !file.dirty) {
        return;
      }
      event.preventDefault();
      void desktop.workspace
        .writeFile(file.path, file.content)
        .then(() => {
          setOpenFiles((current) =>
            current.map((entry) =>
              entry.path === file.path
                ? { ...entry, dirty: entry.content !== file.content }
                : entry,
            ),
          );
          setWorkspaceError(null);
        })
        .catch((error: unknown) =>
          setWorkspaceError(
            error instanceof Error ? error.message : "Could not save workspace file",
          ),
        );
    }
    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [activeTab, openFiles]);

  useEffect(() => {
    function handleDesktopShortcut(event: KeyboardEvent) {
      if (!event.metaKey && !event.ctrlKey) {
        return;
      }

      const key = event.key.toLowerCase();
      if (event.shiftKey && key === "o") {
        event.preventDefault();
        void openWorkspacePicker();
      } else if (!event.shiftKey && key === "n") {
        event.preventDefault();
        startNewConversation();
      }
    }

    window.addEventListener("keydown", handleDesktopShortcut);
    return () => window.removeEventListener("keydown", handleDesktopShortcut);
  }, [openWorkspacePicker, startNewConversation]);

  async function sendMessage() {
    const message = prompt.trim();
    if (!message) {
      return;
    }

    const activeId = activeConversationId;
    const runId = crypto.randomUUID();
    const desktop = window.loomDesktop;
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeConversation.id
          ? {
              ...conversation,
              title: conversation.messages.length === 0 ? message.slice(0, 48) : conversation.title,
              messages: [...conversation.messages, { role: "user", content: message }],
            }
          : conversation,
      ),
    );
    updateApprovalState("hidden");
    setPrompt("");
    if (!desktop || desktop.version !== 1 || !gatewayConnected) {
      return;
    }
    setActiveRunId(runId);
    activeRunIdRef.current = runId;
    setGatewayError(null);
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeId
          ? {
              ...conversation,
              messages: [
                ...conversation.messages,
                { role: "assistant", content: "", status: "streaming" },
              ],
            }
          : conversation,
      ),
    );
    try {
      await desktop.agent.stream(
        runId,
        {
          model: gatewayModel,
          messages: [
            ...activeConversation.messages,
            { role: "user" as const, content: message },
          ].map(({ role, content, status }) => ({
            role,
            content: status === "error" && !content ? "Run failed" : content,
          })),
        },
        (update) => {
          if (update.approval) {
            const pending = { conversationId: activeId, request: update.approval };
            pendingApprovalRef.current = pending;
            setPendingApproval(pending);
          }
          if (update.done) {
            pendingApprovalRef.current = null;
            setPendingApproval(null);
            setConversations((current) =>
              current.map((conversation) => {
                if (conversation.id !== activeId) {
                  return conversation;
                }
                const messages = [...conversation.messages];
                const last = messages.at(-1);
                if (last?.role === "assistant") {
                  messages[messages.length - 1] = { ...last, status: undefined };
                }
                return { ...conversation, messages };
              }),
            );
          }
          if (update.error) {
            setConversations((current) =>
              current.map((conversation) => {
                if (conversation.id !== activeId) {
                  return conversation;
                }
                const messages = [...conversation.messages];
                const last = messages.at(-1);
                if (last?.role === "assistant") {
                  messages[messages.length - 1] = {
                    ...last,
                    content: last.content || update.error!,
                    status: "error",
                  };
                }
                return { ...conversation, messages };
              }),
            );
            return;
          }
          if (update.content) {
            setConversations((current) =>
              current.map((conversation) => {
                if (conversation.id !== activeId) {
                  return conversation;
                }
                const messages = [...conversation.messages];
                const last = messages.at(-1);
                if (last?.role === "assistant") {
                  messages[messages.length - 1] = {
                    ...last,
                    content: last.content + update.content,
                  };
                }
                return { ...conversation, messages };
              }),
            );
          }
        },
      );
      setConversations((current) =>
        current.map((conversation) => {
          if (conversation.id !== activeId) {
            return conversation;
          }
          const messages = [...conversation.messages];
          const last = messages.at(-1);
          if (last?.role === "assistant") {
            messages[messages.length - 1] = { ...last, status: undefined };
          }
          return { ...conversation, messages };
        }),
      );
    } catch (error) {
      const text = error instanceof Error ? error.message : "Agent request failed";
      setGatewayError(text);
      setConversations((current) =>
        current.map((conversation) => {
          if (conversation.id !== activeId) {
            return conversation;
          }
          const messages = [...conversation.messages];
          const last = messages.at(-1);
          if (last?.role === "assistant") {
            messages[messages.length - 1] = {
              ...last,
              content: last.content || text,
              status: "error",
            };
          }
          return { ...conversation, messages };
        }),
      );
    } finally {
      if (activeRunIdRef.current === runId) {
        activeRunIdRef.current = null;
        setActiveRunId(null);
      }
    }
  }

  async function respondToApproval(approved: boolean) {
    const pending = pendingApprovalRef.current;
    if (!pending || !window.loomDesktop?.agent) {
      return;
    }
    const result = await window.loomDesktop.agent.respondApproval(pending.request.id, approved);
    if (!result.accepted) {
      setGatewayError("This approval request is no longer active.");
      setPendingApproval(null);
      pendingApprovalRef.current = null;
    } else {
      setPendingApproval(null);
      pendingApprovalRef.current = null;
    }
  }

  async function cancelActiveRun() {
    const runId = activeRunId;
    if (
      !runId ||
      !window.loomDesktop ||
      window.loomDesktop.version !== 1 ||
      !window.loomDesktop.agent
    ) {
      return;
    }
    await window.loomDesktop.agent.cancel(runId);
    activeRunIdRef.current = null;
    setActiveRunId(null);
    setConversations((current) =>
      current.map((conversation) => {
        if (conversation.id !== activeConversationId) {
          return conversation;
        }
        const messages = [...conversation.messages];
        const last = messages.at(-1);
        if (last?.role === "assistant" && last.status === "streaming") {
          messages[messages.length - 1] = {
            ...last,
            content: last.content || "Run cancelled",
            status: "error",
          };
        }
        return { ...conversation, messages };
      }),
    );
  }

  async function connectGateway() {
    if (!window.loomDesktop || window.loomDesktop.version !== 1) {
      setGatewayError("Connect an OpenAI-compatible provider in the desktop app.");
      return;
    }
    try {
      await window.loomDesktop.agent.configure({
        baseUrl: gatewayBaseUrl,
        apiKey: gatewayApiKey,
        model: gatewayModel,
      });
      setGatewayApiKey("");
      setGatewayConnected(true);
      setSelectedModel(gatewayModel);
      setGatewayError(null);
    } catch (error) {
      setGatewayError(error instanceof Error ? error.message : "Could not configure provider");
    }
  }

  function updateApprovalState(approvalState: ApprovalState) {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeConversationId
          ? { ...conversation, approvalState }
          : conversation,
      ),
    );
  }

  function toWorkspaceFile(entry: WorkspaceEntry): WorkspaceFile {
    return { path: entry.path, isDir: entry.isDir, size: entry.size };
  }

  async function loadWorkspaceDirectory(path: string): Promise<WorkspaceEntry[]> {
    const desktop = window.loomDesktop;
    if (!desktop || desktop.version !== 1) {
      return [];
    }

    const entries = await desktop.workspace.list(path);
    setWorkspaceFiles((current) => {
      const byPath = new Map(current.map((file) => [file.path, file]));
      for (const entry of entries) {
        const existing = byPath.get(entry.path);
        byPath.set(entry.path, {
          ...toWorkspaceFile(entry),
          content: existing?.content,
          draftContent: existing?.draftContent,
          file: existing?.file,
        });
      }
      return [...byPath.values()];
    });
    return entries;
  }

  async function refreshWorkspace() {
    if (!workspaceRoot || !window.loomDesktop || window.loomDesktop.version !== 1) {
      return;
    }
    try {
      const entries = await window.loomDesktop.workspace.list(".");
      setWorkspaceFiles(entries.map(toWorkspaceFile));
      setWorkspaceError(null);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Could not refresh workspace");
    }
  }

  async function createWorkspaceFile() {
    const path = newFilePath.trim().replaceAll("\\", "/");
    if (!path || workspaceFiles.some((file) => file.path === path)) {
      setWorkspaceError(path ? "A file with this path already exists." : "Enter a file path.");
      return;
    }
    try {
      if (window.loomDesktop?.version === 1) {
        await window.loomDesktop.workspace.createFile(path);
      }
      const file = { path, content: "", isDir: false };
      setWorkspaceFiles((current) => [...current, file]);
      setOpenFiles((current) => [...current, { path, content: "", dirty: false }]);
      setActiveTab(path);
      setNewFilePath("");
      setCreateFileOpen(false);
      setWorkspaceError(null);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Could not create workspace file");
    }
  }

  async function createWorkspaceDirectory() {
    const path = newDirectoryPath.trim().replaceAll("\\", "/");
    if (!path) {
      setWorkspaceError("Enter a folder path.");
      return;
    }
    try {
      if (window.loomDesktop?.version === 1) {
        await window.loomDesktop.workspace.createDirectory(path);
      }
      setWorkspaceFiles((current) => [...current, { path, isDir: true }]);
      setNewDirectoryPath("");
      setCreateDirectoryOpen(false);
      setWorkspaceError(null);
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Could not create workspace folder",
      );
    }
  }

  async function deleteWorkspacePath(path: string) {
    try {
      if (window.loomDesktop?.version === 1) {
        await window.loomDesktop.workspace.delete(path);
      }
      setWorkspaceFiles((current) =>
        current.filter((file) => file.path !== path && !file.path.startsWith(`${path}/`)),
      );
      setOpenFiles((current) => current.filter((file) => file.path !== path));
      if (activeTab === path) setActiveTab("chat");
      setDeletePath(null);
      setWorkspaceError(null);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Could not delete workspace item");
      setDeletePath(null);
    }
  }

  function chooseDirectory(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) {
      return;
    }

    const rootName = (selectedFiles[0].webkitRelativePath || selectedFiles[0].name).split(
      /[\\/]/,
    )[0];
    const entries = selectedFiles.map((file) => ({
      path: (file.webkitRelativePath || file.name).split(/[\\/]/).slice(1).join("/") || file.name,
      size: file.size,
      file,
    }));
    setWorkspaceRoot(rootName);
    setWorkspaceFiles(entries);
    setOpenFiles([]);
    setActiveTab("chat");
  }

  async function openWorkspaceFile(path: string) {
    const workspaceFile = workspaceFiles.find((file) => file.path === path);
    if (!workspaceFile || workspaceFile.isDir) {
      return;
    }
    if ((workspaceFile.size ?? workspaceFile.file?.size ?? 0) > MAX_EDITOR_FILE_BYTES) {
      setWorkspaceError("Files larger than the 50 MiB editor limit cannot be opened.");
      return;
    }

    try {
      const content =
        workspaceFile.draftContent ??
        workspaceFile.content ??
        (workspaceFile.file
          ? await workspaceFile.file.text()
          : window.loomDesktop?.version === 1 && workspaceFile.file === undefined
            ? (await window.loomDesktop.workspace.readFile(path)).content
            : "This file cannot be previewed in the browser.");
      setOpenFiles((current) =>
        current.some((file) => file.path === path)
          ? current
          : [...current, { path, content, dirty: workspaceFile.draftContent !== undefined }],
      );
      setActiveTab(path);
      setWorkspaceError(null);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Could not read workspace file");
    }
  }

  function updateOpenFile(path: string, content: string) {
    setOpenFiles((current) =>
      current.map((file) => (file.path === path ? { ...file, content, dirty: true } : file)),
    );
    setWorkspaceFiles((current) =>
      current.map((file) => (file.path === path ? { ...file, draftContent: content } : file)),
    );
  }

  function closeOpenFile(path: string) {
    setOpenFiles((current) => current.filter((item) => item.path !== path));
    if (activeTab === path) {
      setActiveTab("chat");
    }
  }

  const saveOpenFile = useCallback(
    async (path: string, content?: string) => {
      const openFile = openFiles.find((file) => file.path === path);
      if (!openFile) {
        return;
      }
      const contentToSave = content ?? openFile.content;

      try {
        if (window.loomDesktop?.version === 1) {
          await window.loomDesktop.workspace.writeFile(path, contentToSave);
        }
        setOpenFiles((current) =>
          current.map((file) =>
            file.path === path ? { ...file, dirty: file.content !== contentToSave } : file,
          ),
        );
        setWorkspaceFiles((current) =>
          current.map((file) =>
            file.path === path
              ? {
                  ...file,
                  content: contentToSave,
                  draftContent: file.draftContent === contentToSave ? undefined : file.draftContent,
                }
              : file,
          ),
        );
        setWorkspaceError(null);
      } catch (error) {
        setWorkspaceError(error instanceof Error ? error.message : "Could not save workspace file");
      }
    },
    [openFiles],
  );

  function addExtension() {
    const name = extensionName.trim();
    if (!name) {
      return;
    }
    const kind = extensionDialog === "mcp" ? "MCP" : "Plugin";
    setExtensions((current) => [...current, `${kind}: ${name}`]);
    setExtensionName("");
    setExtensionDialog(null);
  }

  const isDark = themeMode === "dark";
  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ??
    conversations[0];
  const messages = activeConversation.messages;
  const approvalRequest = activeConversation.approvalState ?? "hidden";
  const activeFile = openFiles.find((file) => file.path === activeTab);
  const treeData = makeWorkspaceTree(workspaceFiles);

  useEffect(() => {
    if (!autoSaveFiles || !activeFile?.dirty) {
      return;
    }

    const path = activeFile.path;
    const content = activeFile.content;
    const timeout = window.setTimeout(() => void saveOpenFile(path, content), 700);
    return () => window.clearTimeout(timeout);
  }, [autoSaveFiles, activeFile?.content, activeFile?.dirty, activeFile?.path, saveOpenFile]);

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: "#7565e8",
          borderRadius: 10,
          fontFamily: 'Inter, "Segoe UI", sans-serif',
        },
      }}
    >
      <div className="loom-app" data-theme={themeMode}>
        <nav className="global-menu-bar" aria-label="Application menu">
          <Space size={2} className="application-menus">
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [
                  {
                    key: "new-chat",
                    label: "New Chat",
                    disabled: !activeConversation?.messages.length,
                  },
                  { key: "open-folder", label: "Open Folder…" },
                  { type: "divider" },
                  {
                    key: "save-all",
                    label: "Save All",
                    disabled: !openFiles.some((file) => file.dirty),
                  },
                  {
                    key: "auto-save",
                    label: (
                      <Space>
                        Auto Save
                        <Switch
                          size="small"
                          checked={autoSaveFiles}
                          onClick={(_, event) => event.stopPropagation()}
                          onChange={setAutoSaveFiles}
                        />
                      </Space>
                    ),
                  },
                ],
                onClick: ({ key }) => {
                  if (key === "new-chat") startNewConversation();
                  if (key === "open-folder") void openWorkspacePicker();
                  if (key === "save-all") {
                    for (const file of openFiles.filter((item) => item.dirty)) {
                      void saveOpenFile(file.path, file.content);
                    }
                  }
                },
              }}
            >
              <Button type="text" aria-label="File">
                File
              </Button>
            </Dropdown>
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [{ key: "select-all", label: "Select All" }],
                onClick: () => {
                  const selector =
                    activeTab === "chat" ? '[aria-label="Message Loom"]' : ".code-editor";
                  document.querySelector<HTMLTextAreaElement>(selector)?.select();
                },
              }}
            >
              <Button type="text" aria-label="Edit">
                Edit
              </Button>
            </Dropdown>
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [
                  {
                    key: "toggle-left",
                    label: conversationSidebarOpen ? "Hide Conversations" : "Show Conversations",
                  },
                  {
                    key: "toggle-right",
                    label: workspaceExplorerOpen
                      ? "Hide Workspace Explorer"
                      : "Show Workspace Explorer",
                  },
                ],
                onClick: ({ key }) => {
                  if (key === "toggle-left") setConversationSidebarOpen((open) => !open);
                  if (key === "toggle-right") setWorkspaceExplorerOpen((open) => !open);
                },
              }}
            >
              <Button type="text" aria-label="View">
                View
              </Button>
            </Dropdown>
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [{ key: "about", label: "About Loom" }],
                onClick: () => setAboutOpen(true),
              }}
            >
              <Button type="text" aria-label="Help">
                Help
              </Button>
            </Dropdown>
          </Space>
          <Space size="middle">
            <Text className="workspace-label">{workspaceRoot ?? "No workspace open"}</Text>
            <Tag variant="filled">Desktop workspace</Tag>
            <Button
              type="text"
              aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
              icon={isDark ? <SunOutlined /> : <MoonOutlined />}
              onClick={() => setThemeMode(isDark ? "light" : "dark")}
            />
          </Space>
        </nav>
        <ResizablePanelShell
          leftOpen={conversationSidebarOpen}
          rightOpen={workspaceExplorerOpen}
          onExpandLeft={() => setConversationSidebarOpen(true)}
          onExpandRight={() => setWorkspaceExplorerOpen(true)}
          left={
            <ConversationSidebar
              conversations={conversations}
              activeConversationId={activeConversationId}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectConversation={setActiveConversationId}
              onNewConversation={startNewConversation}
              canCreateConversation={activeConversation.messages.length > 0}
              onDeleteConversation={setConversationToDelete}
              onOpenSettings={() => setSettingsOpen(true)}
              onCollapse={() => setConversationSidebarOpen(false)}
              collapsed={!conversationSidebarOpen}
              onExpand={() => setConversationSidebarOpen(true)}
            />
          }
          center={
            <Layout className="center-layout">
              <Content className="conversation-area" role="main" aria-label="Conversation">
                {openFiles.length > 0 && (
                  <div className="editor-tabs" role="tablist" aria-label="Open views">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === "chat"}
                      onClick={() => setActiveTab("chat")}
                    >
                      <MessageOutlined /> Chat
                    </button>
                    {openFiles.map((file) => (
                      <span className="editor-tab" key={file.path} title={file.path}>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activeTab === file.path}
                          onClick={() => setActiveTab(file.path)}
                        >
                          <CodeOutlined /> {file.path.split(/[\\/]/).at(-1)}
                          {file.dirty && <span aria-label="Unsaved changes">●</span>}
                        </button>
                        <Button
                          type="text"
                          size="small"
                          aria-label={`Close ${file.path.split(/[\\/]/).at(-1)}`}
                          icon={<CloseOutlined />}
                          onClick={() =>
                            file.dirty ? setCloseFilePrompt(file) : closeOpenFile(file.path)
                          }
                        />
                      </span>
                    ))}
                  </div>
                )}

                {activeTab === "chat" ? (
                  <div className="chat-panel" role="tabpanel" aria-label="Chat">
                    {messages.length === 0 ? (
                      <section className="welcome" aria-label="Welcome">
                        <div className="welcome-mark">
                          <img src="/loom-avatar.png" alt="" />
                        </div>
                        <Title level={2}>What are we building today?</Title>
                        <Text type="secondary">
                          Open a folder and start working with your agent.
                        </Text>
                      </section>
                    ) : (
                      <section className="message-list" aria-label="Messages" role="log">
                        {messages.map((message, index) => (
                          <div
                            className={
                              message.role === "user" ? "user-message" : "assistant-message"
                            }
                            key={`${index}-${message.role}`}
                          >
                            {message.content || (message.status === "streaming" ? "Thinking…" : "")}
                          </div>
                        ))}
                        {!gatewayConnected && (
                          <Text type="secondary" className="prototype-note">
                            Configure an OpenAI-compatible provider in Settings to start an agent
                            run.
                          </Text>
                        )}
                        {!gatewayConnected && approvalRequest === "hidden" && (
                          <Button
                            onClick={() =>
                              updateApprovalState(getApprovalPreviewState(approvalMode))
                            }
                          >
                            Preview tool approval
                          </Button>
                        )}
                        {gatewayConnected &&
                          pendingApproval?.conversationId === activeConversation.id && (
                            <section
                              className="approval-card"
                              aria-label="Agent tool approval request"
                            >
                              <div>
                                <Text strong>{pendingApproval.request.toolName}</Text>
                                <Text type="secondary">
                                  Review the workspace-scoped tool request before it runs.
                                </Text>
                                <pre className="diff-preview">
                                  {JSON.stringify(pendingApproval.request.arguments, null, 2)}
                                </pre>
                              </div>
                              <Space>
                                <Button onClick={() => void respondToApproval(false)}>
                                  Reject
                                </Button>
                                <Button type="primary" onClick={() => void respondToApproval(true)}>
                                  Approve once
                                </Button>
                              </Space>
                            </section>
                          )}
                        {approvalRequest === "pending" && !gatewayConnected && (
                          <section className="approval-card" aria-label="Tool approval request">
                            <div>
                              <Text strong>Write src/App.tsx</Text>
                              <Text type="secondary">File write access · this request only</Text>
                            </div>
                            <Space>
                              <Button onClick={() => updateApprovalState("rejected")}>
                                Reject
                              </Button>
                              <Button
                                type="primary"
                                onClick={() => updateApprovalState("approved")}
                              >
                                Approve once
                              </Button>
                            </Space>
                          </section>
                        )}
                        {approvalRequest === "approved" && !gatewayConnected && (
                          <section className="diff-review-card" aria-label="Proposed changes">
                            <div className="diff-review-heading">
                              <div>
                                <Text strong>Proposed edit · src/App.tsx</Text>
                                <Text type="secondary">
                                  Review this sample diff before accepting it.
                                </Text>
                              </div>
                              <Tag color="orange">Pending review</Tag>
                            </div>
                            <pre className="diff-preview">
                              <code>
                                {
                                  "@@ -1 +1 @@\n- What are we building today?\n+ Build something thoughtful."
                                }
                              </code>
                            </pre>
                            <Space>
                              <Button onClick={() => updateApprovalState("changes-rejected")}>
                                Reject changes
                              </Button>
                              <Button
                                type="primary"
                                onClick={() => updateApprovalState("changes-accepted")}
                              >
                                Accept changes
                              </Button>
                            </Space>
                          </section>
                        )}
                        {approvalRequest === "changes-accepted" && (
                          <Text role="status">
                            Changes accepted in preview. No files were changed.
                          </Text>
                        )}
                        {approvalRequest === "changes-rejected" && (
                          <Text role="status">Changes rejected. No files were changed.</Text>
                        )}
                        {approvalRequest === "rejected" && (
                          <Text role="status">Request rejected. No files were changed.</Text>
                        )}
                      </section>
                    )}

                    <div className="composer-wrap">
                      <Input.TextArea
                        aria-label="Message Loom"
                        placeholder="Ask Loom to change something..."
                        autoSize={{ minRows: 2, maxRows: 5 }}
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                        onPressEnter={(event) => {
                          if (!event.shiftKey) {
                            event.preventDefault();
                            sendMessage();
                          }
                        }}
                      />
                      <ComposerControls
                        model={selectedModel}
                        reasoning={reasoningLevel}
                        approvalMode={approvalMode}
                        extensions={extensions}
                        onModelChange={setSelectedModel}
                        onReasoningChange={setReasoningLevel}
                        onApprovalModeChange={setApprovalMode}
                        onAddExtension={setExtensionDialog}
                      />
                      <div className="composer-footer">
                        <Text type="secondary">Enter to send · Shift+Enter for a new line</Text>
                        {activeRunId ? (
                          <Button
                            type="primary"
                            danger
                            shape="circle"
                            aria-label="Stop run"
                            icon={<StopOutlined />}
                            onClick={() => void cancelActiveRun()}
                          />
                        ) : (
                          <Button
                            type="primary"
                            shape="circle"
                            aria-label="Send message"
                            icon={<ArrowUpOutlined />}
                            disabled={!prompt.trim()}
                            onClick={() => void sendMessage()}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  activeFile && (
                    <section className="file-editor" role="tabpanel" aria-label={activeFile.path}>
                      <div className="editor-toolbar">
                        <div className="editor-breadcrumb">
                          {workspaceRoot} / {activeFile.path}
                        </div>
                        <Button
                          type="primary"
                          disabled={!activeFile.dirty}
                          onClick={() => void saveOpenFile(activeFile.path)}
                        >
                          {window.loomDesktop?.version === 1 ? "Save" : "Save session changes"}
                        </Button>
                      </div>
                      <div className="code-editor-shell">
                        <div className="code-editor-scroll" aria-label="Code editor">
                          <div
                            ref={editorGutterRef}
                            className="code-editor-gutter"
                            aria-label="Editor line numbers"
                          >
                            {activeFile.content.split("\n").map((_, index) => (
                              <span key={index}>{index + 1}</span>
                            ))}
                          </div>
                          <Input.TextArea
                            aria-label={`Editor content ${activeFile.path}`}
                            className="code-editor"
                            spellCheck={false}
                            wrap="off"
                            value={activeFile.content}
                            onScroll={(event) => {
                              if (editorGutterRef.current) {
                                editorGutterRef.current.scrollTop = event.currentTarget.scrollTop;
                              }
                            }}
                            onChange={(event) =>
                              updateOpenFile(activeFile.path, event.target.value)
                            }
                          />
                        </div>
                      </div>
                      {activeFile.dirty && (
                        <Text className="editor-status" role="status">
                          {autoSaveFiles
                            ? window.loomDesktop?.version === 1
                              ? "Unsaved changes · Auto Save will write after a short pause."
                              : "Unsaved session changes · Auto Save updates this preview session only."
                            : window.loomDesktop?.version === 1
                              ? "Unsaved changes · Save writes to the workspace."
                              : "Unsaved session changes · preview only; nothing written to disk."}
                        </Text>
                      )}
                    </section>
                  )
                )}
              </Content>
            </Layout>
          }
          right={
            <WorkspaceExplorer
              open={workspaceExplorerOpen}
              workspaceRoot={workspaceRoot}
              gatewayConnected={gatewayConnected}
              workspaceError={workspaceError}
              treeData={treeData}
              workspaceFiles={workspaceFiles}
              onOpenFolder={() => void openWorkspacePicker()}
              onRefresh={() => void refreshWorkspace()}
              onCreateFile={(initialPath = "") => {
                setNewFilePath(initialPath);
                setCreateFileOpen(true);
              }}
              onCreateDirectory={(initialPath = "") => {
                setNewDirectoryPath(initialPath);
                setCreateDirectoryOpen(true);
              }}
              onDelete={setDeletePath}
              onOpenFile={(path) => void openWorkspaceFile(path)}
              onLoadDirectory={loadWorkspaceDirectory}
              onCollapse={() => setWorkspaceExplorerOpen(false)}
              onExpand={() => setWorkspaceExplorerOpen(true)}
            />
          }
        />
        <Modal
          title="About Loom"
          open={aboutOpen}
          onCancel={() => setAboutOpen(false)}
          footer={null}
        >
          <Text>
            Loom is a local-first coding workspace with an OpenAI-compatible agent runtime.
          </Text>
        </Modal>
        <Modal
          title="Delete conversation?"
          open={conversationToDelete !== null}
          onCancel={() => setConversationToDelete(null)}
          onOk={deleteConversation}
          okText="Delete chat"
          okButtonProps={{ danger: true }}
        >
          This removes the conversation and its messages from this app.
        </Modal>
        <Modal
          title="Create a file"
          open={createFileOpen}
          onCancel={() => setCreateFileOpen(false)}
          onOk={() => void createWorkspaceFile()}
          okText="Create and open"
        >
          <Input
            autoFocus
            aria-label="New file path"
            placeholder="src/new-file.ts"
            value={newFilePath}
            onChange={(event) => setNewFilePath(event.target.value)}
            onPressEnter={() => void createWorkspaceFile()}
          />
        </Modal>
        <Modal
          title="Create a folder"
          open={createDirectoryOpen}
          onCancel={() => setCreateDirectoryOpen(false)}
          onOk={() => void createWorkspaceDirectory()}
          okText="Create folder"
        >
          <Input
            autoFocus
            aria-label="New folder path"
            placeholder="src/components"
            value={newDirectoryPath}
            onChange={(event) => setNewDirectoryPath(event.target.value)}
            onPressEnter={() => void createWorkspaceDirectory()}
          />
        </Modal>
        <Modal
          title="Delete workspace item?"
          open={deletePath !== null}
          onCancel={() => setDeletePath(null)}
          onOk={() => deletePath && void deleteWorkspacePath(deletePath)}
          okText="Delete"
          okButtonProps={{ danger: true }}
        >
          {deletePath}
        </Modal>
        <Modal
          title="Discard unsaved changes?"
          open={closeFilePrompt !== null}
          onCancel={() => setCloseFilePrompt(null)}
          onOk={() => {
            if (closeFilePrompt) {
              closeOpenFile(closeFilePrompt.path);
            }
            setCloseFilePrompt(null);
          }}
          okText="Discard changes"
          okButtonProps={{ danger: true }}
          cancelText="Keep editing"
        >
          The changes in {closeFilePrompt?.path} have not been saved.
        </Modal>
        <input
          ref={directoryInputRef}
          aria-label="Workspace folder input"
          className="directory-input"
          type="file"
          multiple
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          onChange={(event) => chooseDirectory(event.currentTarget.files)}
        />
        <Drawer
          title="Settings"
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          size={520}
        >
          <Tabs
            items={[
              {
                key: "account",
                label: "Account",
                children: (
                  <section className="settings-section" aria-label="Account information">
                    <Text strong>Signed-in account</Text>
                    <Text type="secondary">
                      Preview account details. This is not a live identity.
                    </Text>
                    <div className="account-detail">
                      <Text type="secondary">Name</Text>
                      <Text>Loom Preview</Text>
                    </div>
                    <div className="account-detail">
                      <Text type="secondary">Email</Text>
                      <Text>demo@loom.local</Text>
                    </div>
                    <div className="account-detail">
                      <Text type="secondary">Organization</Text>
                      <Text>Demo workspace</Text>
                    </div>
                    <div className="account-detail">
                      <Text type="secondary">Sign-in method</Text>
                      <Text>Organization gateway</Text>
                    </div>
                  </section>
                ),
              },
              {
                key: "gateway",
                label: "Gateway",
                children: (
                  <section className="settings-section" aria-label="Gateway connection">
                    <Text strong>Gateway connection</Text>
                    <Text type="secondary">
                      Connect to an OpenAI-compatible API or gateway. The API key is encrypted with
                      OS storage in the desktop app.
                    </Text>
                    <label htmlFor="gateway-url">Base URL</label>
                    <Input
                      id="gateway-url"
                      value={gatewayBaseUrl}
                      onChange={(event) => setGatewayBaseUrl(event.target.value)}
                    />
                    <label htmlFor="gateway-model">Gateway model</label>
                    <Input
                      id="gateway-model"
                      value={gatewayModel}
                      onChange={(event) => setGatewayModel(event.target.value)}
                    />
                    <label htmlFor="gateway-api-key">API key</label>
                    <Input.Password
                      id="gateway-api-key"
                      autoComplete="new-password"
                      value={gatewayApiKey}
                      onChange={(event) => setGatewayApiKey(event.target.value)}
                      placeholder={
                        gatewayConnected ? "Saved securely · enter to replace" : "API key"
                      }
                    />
                    {gatewayError && (
                      <Text type="danger" role="alert">
                        {gatewayError}
                      </Text>
                    )}
                    <div className="connection-state">
                      <span className={`status-dot${gatewayConnected ? " connected" : ""}`} />
                      {gatewayConnected ? `Connected · ${gatewayModel}` : "Provider not configured"}
                    </div>
                    <Button type="primary" onClick={() => void connectGateway()}>
                      {gatewayConnected ? "Save provider settings" : "Connect provider"}
                    </Button>
                  </section>
                ),
              },
            ]}
          />
        </Drawer>
        <Modal
          title={extensionDialog === "mcp" ? "Add MCP server" : "Add plugin"}
          open={extensionDialog !== null}
          onCancel={() => setExtensionDialog(null)}
          onOk={addExtension}
          okText={extensionDialog === "mcp" ? "Add MCP server" : "Add plugin"}
        >
          <div className="settings-section">
            <Text type="secondary">
              Preview only. Connections and plugin loading are not enabled until the runtime is
              integrated.
            </Text>
            <Input
              aria-label={extensionDialog === "mcp" ? "MCP server name" : "Plugin name"}
              placeholder={extensionDialog === "mcp" ? "Server name" : "Plugin name"}
              value={extensionName}
              onChange={(event) => setExtensionName(event.target.value)}
            />
          </div>
        </Modal>
      </div>
    </ConfigProvider>
  );
}

export default App;
