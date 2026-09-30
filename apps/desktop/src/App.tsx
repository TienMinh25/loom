import {
  Fragment,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { ApprovalState, Conversation, ToolApprovalActivity } from "./types/conversation";
import { loadConversationState, NEW_CHAT_ID, saveConversationState } from "./conversationStorage";
import type { AgentApprovalRequest } from "../shared/desktopApi";
import { MODEL_OPTIONS } from "./modelOptions";
import { ConversationSidebar } from "./components/ConversationSidebar";
import { WorkspaceExplorer } from "./components/WorkspaceExplorer";
import { ComposerControls } from "./components/ComposerControls";
import type { CodeEditorHandle, CodeEditorStateCache } from "./components/CodeEditor";
import { getApprovalPreviewState, type ApprovalMode } from "./approvalMode";
import { isCompactPanelLayout } from "./panelLayout";
import type { WorkspaceEntry } from "../shared/desktopApi";
import { ResizablePanelShell } from "./components/ResizablePanelShell";
import type { WorkspaceTreeNode } from "./components/WorkspaceExplorer";
import { useFocusScope } from "./components/ui/useFocusScope";
import {
  Badge,
  Button,
  Dialog,
  Icon,
  IconButton,
  Menu,
  Tabs,
  Text,
  TextArea,
  TextField,
  Title,
} from "./components/ui";
import "./App.css";

const CodeEditor = lazy(() =>
  import("./components/CodeEditor").then((module) => ({
    default: module.CodeEditor,
  })),
);

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
type OpenFile = { path: string; content: string; savedContent: string; dirty: boolean };

function makeWorkspaceTree(files: WorkspaceFile[]): WorkspaceTreeNode[] {
  const root: WorkspaceTreeNode[] = [];
  const nodes = new Map<string, WorkspaceTreeNode>();

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

function handleWorkbenchTabKeyDown(
  event: ReactKeyboardEvent<HTMLButtonElement>,
  onActivate: (key: string) => void,
) {
  const tabs = Array.from(
    event.currentTarget
      .closest('[role="tablist"]')
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
  );
  const currentIndex = tabs.indexOf(event.currentTarget);
  let nextIndex: number | undefined;
  if (event.key === "ArrowRight") {
    nextIndex = (currentIndex + 1) % tabs.length;
  } else if (event.key === "ArrowLeft") {
    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = tabs.length - 1;
  }
  if (nextIndex === undefined || tabs.length === 0) {
    return;
  }
  event.preventDefault();
  const nextTab = tabs[nextIndex];
  const key = nextTab?.dataset.tabKey;
  if (nextTab && key) {
    nextTab.focus();
    onActivate(key);
  }
}

function handleSettingsCategoryKeyDown(
  event: ReactKeyboardEvent<HTMLButtonElement>,
  onActivate: (category: string) => void,
) {
  const categories = Array.from(
    event.currentTarget
      .closest(".settings-categories")
      ?.querySelectorAll<HTMLButtonElement>(".settings-category") ?? [],
  );
  const currentIndex = categories.indexOf(event.currentTarget);
  let nextIndex: number | undefined;
  if (event.key === "ArrowDown" || event.key === "ArrowRight") {
    nextIndex = (currentIndex + 1) % categories.length;
  } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
    nextIndex = (currentIndex - 1 + categories.length) % categories.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = categories.length - 1;
  }
  if (nextIndex === undefined || categories.length === 0) {
    return;
  }
  event.preventDefault();
  const nextCategory = categories[nextIndex];
  if (nextCategory) {
    nextCategory.focus();
    nextCategory.scrollIntoView({ block: "nearest", inline: "nearest" });
    onActivate(nextCategory.textContent ?? "");
  }
}

function ToolActivityCard({
  activity,
  actionable,
  onRespond,
}: {
  activity: ToolApprovalActivity;
  actionable: boolean;
  onRespond(approved: boolean): void;
}) {
  const statusLabel =
    activity.status === "approved"
      ? "Approved once"
      : activity.status === "rejected"
        ? "Rejected"
        : activity.status === "unavailable"
          ? "Approval unavailable"
          : actionable
            ? "Approval required"
            : "Waiting for approval";

  return (
    <section className="tool-activity" aria-label={`Tool request ${activity.toolName}`}>
      <div className="tool-activity-heading">
        <Text strong>{activity.toolName}</Text>
        <Badge>{statusLabel}</Badge>
      </div>
      <pre className="diff-preview">{JSON.stringify(activity.arguments, null, 2)}</pre>
      {actionable && (
        <div className="tool-activity-actions flex-wrap">
          <Button onClick={() => onRespond(false)}>Reject</Button>
          <Button type="primary" onClick={() => onRespond(true)}>
            Approve once
          </Button>
        </div>
      )}
    </section>
  );
}

function App() {
  const [compactViewport, setCompactViewport] = useState(() =>
    isCompactPanelLayout(window.innerWidth),
  );
  const [desktopMenuMode] = useState(() => Boolean(window.loomDesktop?.version === 1));
  const [prompt, setPrompt] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>(
    () => loadConversationState(localStorage).conversations,
  );
  const [activeConversationId, setActiveConversationId] = useState(
    () => loadConversationState(localStorage).activeConversationId,
  );
  const [conversationDrafts, setConversationDrafts] = useState<Record<string, string>>({});
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<"dark" | "light">(() =>
    localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark",
  );
  const [conversationSidebarOpen, setConversationSidebarOpen] = useState(
    () => localStorage.getItem(LEFT_PANEL_OPEN_KEY) !== "false",
  );
  const [workspaceExplorerOpen, setWorkspaceExplorerOpen] = useState(
    () => localStorage.getItem(RIGHT_PANEL_OPEN_KEY) === "true",
  );
  const [createFileOpen, setCreateFileOpen] = useState(false);
  const [createDirectoryOpen, setCreateDirectoryOpen] = useState(false);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [createFileError, setCreateFileError] = useState<string | null>(null);
  const [createDirectoryError, setCreateDirectoryError] = useState<string | null>(null);
  const [createWorkspaceError, setCreateWorkspaceError] = useState<string | null>(null);
  const [workspacePathToRename, setWorkspacePathToRename] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [newFilePath, setNewFilePath] = useState("");
  const [newDirectoryPath, setNewDirectoryPath] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [deletePath, setDeletePath] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);
  const [repositoryStatus, setRepositoryStatus] = useState<
    | { state: "loading" }
    | { state: "git"; branch: string }
    | { state: "no-git" }
    | { state: "error" }
  >({ state: "no-git" });
  const workspaceGeneration = useRef(0);
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([]);
  const [workspaceSearchFiles, setWorkspaceSearchFiles] = useState<WorkspaceFile[] | null>(null);
  const [workspaceSearchLoading, setWorkspaceSearchLoading] = useState(false);
  const workspaceSearchGeneration = useRef(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState("Providers");
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
  const [editorStateCache] = useState<CodeEditorStateCache>(() => new Map());
  const [closeFilePrompt, setCloseFilePrompt] = useState<OpenFile | null>(null);
  const [autoSaveFiles, setAutoSaveFiles] = useState(
    () => localStorage.getItem(AUTO_SAVE_STORAGE_KEY) === "true",
  );
  const [activeTab, setActiveTab] = useState("chat");
  const [editorTool, setEditorTool] = useState<"find" | "replace" | "goto" | null>(null);
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [editorActionStatus, setEditorActionStatus] = useState("");
  const [editorCursorLine, setEditorCursorLine] = useState(1);
  const [editorSaveError, setEditorSaveError] = useState<{
    path: string;
    message: string;
  } | null>(null);
  const [editorHistory, setEditorHistory] = useState<{
    path: string;
    canUndo: boolean;
    canRedo: boolean;
  } | null>(null);

  useEffect(() => {
    const updateCompactViewport = () => setCompactViewport(isCompactPanelLayout(window.innerWidth));
    window.addEventListener("resize", updateCompactViewport);
    return () => window.removeEventListener("resize", updateCompactViewport);
  }, []);

  const [approvalMode, setApprovalMode] = useState<ApprovalMode>("ask");
  const [selectedModel, setSelectedModel] = useState("Gateway model");
  const [reasoningLevel, setReasoningLevel] = useState("medium");
  const [extensionDialog, setExtensionDialog] = useState<"plugin" | "mcp" | null>(null);
  const [extensionName, setExtensionName] = useState("");
  const [extensions, setExtensions] = useState<string[]>([]);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const sessionTabsRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLElement>(null);
  const [timelineFollowState, setTimelineFollowState] = useState({
    conversationId: "",
    following: true,
  });
  const editorRef = useRef<CodeEditorHandle>(null);
  const tabFocusAfterClose = useRef<string | null>(null);
  const settingsScopeRef = useRef<HTMLElement>(null);
  const handleSettingsKeyDown = useFocusScope(settingsOpen, settingsScopeRef, () =>
    setSettingsOpen(false),
  );

  useEffect(() => {
    const targetKey = tabFocusAfterClose.current;
    if (!targetKey) {
      return;
    }
    tabFocusAfterClose.current = null;
    if (targetKey === "composer") {
      document.querySelector<HTMLTextAreaElement>('[aria-label="Message Loom"]')?.focus();
      return;
    }
    Array.from(document.querySelectorAll<HTMLButtonElement>("[role='tab'][data-tab-key]"))
      .find((tab) => tab.dataset.tabKey === targetKey)
      ?.focus();
  }, [activeTab, openFiles.length]);

  useEffect(() => {
    sessionTabsRef.current
      ?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activeConversationId]);

  function activateTab(path: string) {
    if (path !== activeTab) {
      if (activeTab !== "chat") {
        const state = editorRef.current?.serializeState();
        if (state) {
          editorStateCache.set(activeTab, state);
        }
      }
      setEditorHistory(null);
    }
    setActiveTab(path);
  }
  const startNewConversation = useCallback(() => {
    const current = conversations.find((conversation) => conversation.id === activeConversationId);
    if (activeConversationId === NEW_CHAT_ID || current?.messages.length === 0) {
      return;
    }
    if (current) {
      setConversationDrafts((drafts) => ({ ...drafts, [activeConversationId]: prompt }));
    } else if (!activeConversationId) {
      setConversationDrafts((drafts) => ({ ...drafts, [NEW_CHAT_ID]: prompt }));
    }
    const newChatPrompt =
      !current && !activeConversationId ? prompt : (conversationDrafts[NEW_CHAT_ID] ?? "");
    setActiveConversationId(NEW_CHAT_ID);
    setPrompt(newChatPrompt);
  }, [activeConversationId, conversationDrafts, conversations, prompt]);

  function selectConversation(id: string) {
    if (activeConversationId === NEW_CHAT_ID) {
      setConversationDrafts((drafts) => ({ ...drafts, [NEW_CHAT_ID]: prompt }));
      setPrompt(conversationDrafts[id] ?? "");
      setActiveConversationId(id);
      return;
    }
    setConversationDrafts((drafts) => ({ ...drafts, [activeConversationId]: prompt }));
    setActiveConversationId(id);
    setPrompt(conversationDrafts[id] ?? "");
  }

  function deleteConversation() {
    if (!conversationToDelete) {
      return;
    }
    const remaining = conversations.filter(
      (conversation) => conversation.id !== conversationToDelete,
    );
    setConversationDrafts((drafts) => {
      const next = { ...drafts };
      delete next[conversationToDelete];
      return next;
    });
    setConversations(remaining);
    if (conversationToDelete === activeConversationId) {
      setActiveConversationId(remaining[0]?.id ?? "");
    }
    setConversationToDelete(null);
  }

  const openWorkspacePicker = useCallback(
    async (create = false, workspaceName = "") => {
      const desktop = window.loomDesktop;
      if (!desktop || desktop.version !== 1) {
        if (create) {
          setCreateWorkspaceError("Create workspace is available in the desktop app.");
          return;
        }
        directoryInputRef.current?.click();
        return;
      }

      try {
        if (create && !desktop.workspace.create) {
          setCreateWorkspaceError("Create workspace is unavailable in this desktop version.");
          return;
        }
        const opened = create
          ? await desktop.workspace.create?.(workspaceName)
          : await desktop.workspace.open();
        if (!opened) {
          return;
        }
        const generation = ++workspaceGeneration.current;
        const entries = await desktop.workspace.list(".");
        if (generation !== workspaceGeneration.current) {
          return;
        }
        setWorkspaceRoot(opened.root);
        if (!desktop.workspace.gitStatus) {
          setRepositoryStatus({ state: "error" });
        } else {
          setRepositoryStatus({ state: "loading" });
          void desktop.workspace
            .gitStatus()
            .then((status) => {
              if (generation !== workspaceGeneration.current) {
                return;
              }
              setRepositoryStatus(
                status.isGit ? { state: "git", branch: status.branch } : { state: "no-git" },
              );
            })
            .catch(() => {
              if (generation === workspaceGeneration.current) {
                setRepositoryStatus({ state: "error" });
              }
            });
        }
        workspaceSearchGeneration.current += 1;
        setWorkspaceSearchFiles(null);
        setWorkspaceSearchLoading(false);
        setWorkspaceFiles(
          entries.map((entry) => ({ path: entry.path, isDir: entry.isDir, size: entry.size })),
        );
        setOpenFiles([]);
        editorStateCache.clear();
        setEditorHistory(null);
        setActiveTab("chat");
        setEditorSaveError(null);
        if (create) {
          setCreateWorkspaceOpen(false);
          setCreateWorkspaceError(null);
          setNewWorkspaceName("");
        }
      } catch (error) {
        if (create) {
          setCreateWorkspaceError(
            error instanceof Error ? error.message : "Could not create workspace",
          );
        } else {
          setWorkspaceError(error instanceof Error ? error.message : "Could not open workspace");
        }
      }
    },
    [editorStateCache],
  );

  function submitCreateWorkspace() {
    const name = newWorkspaceName.trim();
    if (!name || name === "." || name === ".." || /[<>:"/\\|?*]/.test(name)) {
      setCreateWorkspaceError("Enter a workspace name without reserved characters.");
      return;
    }
    setCreateWorkspaceError(null);
    void openWorkspacePicker(true, name);
  }

  const showCreateWorkspaceDialog = useCallback(() => {
    setCreateWorkspaceError(null);
    setNewWorkspaceName("");
    setCreateWorkspaceOpen(true);
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
    window.loomDesktop?.setAutoSaveState?.(autoSaveFiles);
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
    function handleEditorNavigationShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || activeTab === "chat") {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "f") {
        event.preventDefault();
        setEditorTool("find");
      } else if (key === "g") {
        event.preventDefault();
        setEditorTool("goto");
      }
    }
    window.addEventListener("keydown", handleEditorNavigationShortcut);
    return () => window.removeEventListener("keydown", handleEditorNavigationShortcut);
  }, [activeTab]);

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

    const activeId =
      activeConversationId === NEW_CHAT_ID
        ? crypto.randomUUID()
        : activeConversationId || crypto.randomUUID();
    const runId = crypto.randomUUID();
    const desktop = window.loomDesktop;
    setConversations((current) =>
      current.some((conversation) => conversation.id === activeId)
        ? current.map((conversation) =>
            conversation.id === activeId
              ? {
                  ...conversation,
                  title:
                    conversation.messages.length === 0 ? message.slice(0, 48) : conversation.title,
                  messages: [...conversation.messages, { role: "user", content: message }],
                }
              : conversation,
          )
        : [
            {
              id: activeId,
              title: message.slice(0, 48),
              messages: [{ role: "user", content: message }],
              approvalState: "hidden",
            },
            ...current,
          ],
    );
    if (!activeConversationId || activeConversationId === NEW_CHAT_ID) {
      setActiveConversationId(activeId);
    }
    updateApprovalState("hidden");
    setPrompt("");
    setConversationDrafts((drafts) => ({ ...drafts, [activeConversationId]: "" }));
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
          if (activeRunIdRef.current !== runId) {
            return;
          }
          if (update.approval) {
            const pending = { conversationId: activeId, request: update.approval };
            pendingApprovalRef.current = pending;
            setPendingApproval(pending);
            setConversations((current) =>
              current.map((conversation) =>
                conversation.id === activeId
                  ? {
                      ...conversation,
                      toolApprovals: [
                        ...(conversation.toolApprovals ?? []).filter(
                          (activity) => activity.id !== update.approval!.id,
                        ),
                        {
                          id: update.approval!.id,
                          toolName: update.approval!.toolName,
                          arguments: update.approval!.arguments,
                          afterMessageCount: conversation.messages.length,
                          status: "pending",
                        },
                      ],
                    }
                  : conversation,
              ),
            );
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
      if (activeRunIdRef.current === runId) {
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
    } catch (error) {
      if (activeRunIdRef.current !== runId) {
        return;
      }
      const text = error instanceof Error ? error.message : "Agent request failed";
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
    const status: ToolApprovalActivity["status"] = result.accepted
      ? approved
        ? "approved"
        : "rejected"
      : "unavailable";
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === pending.conversationId
          ? {
              ...conversation,
              toolApprovals: (conversation.toolApprovals ?? []).map((activity) =>
                activity.id === pending.request.id ? { ...activity, status } : activity,
              ),
            }
          : conversation,
      ),
    );
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
    const pending = pendingApprovalRef.current;
    if (pending?.conversationId === activeConversationId) {
      pendingApprovalRef.current = null;
      setPendingApproval(null);
    }
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
            status: "cancelled",
          };
        }
        return {
          ...conversation,
          messages,
          toolApprovals: (conversation.toolApprovals ?? []).map((activity) =>
            activity.id === pending?.request.id ? { ...activity, status: "unavailable" } : activity,
          ),
        };
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

  const searchWorkspaceFiles = useCallback(async () => {
    const desktop = window.loomDesktop;
    const generation = workspaceGeneration.current;
    if (workspaceSearchFiles !== null || workspaceSearchLoading) {
      return;
    }
    if (!workspaceRoot || !desktop || desktop.version !== 1) {
      setWorkspaceSearchFiles(workspaceFiles);
      return;
    }

    const searchGeneration = ++workspaceSearchGeneration.current;
    setWorkspaceSearchLoading(true);
    try {
      const queue = ["."];
      const visited = new Set<string>();
      const files: WorkspaceFile[] = [];
      while (queue.length > 0 && visited.size < 5000 && files.length < 20000) {
        const path = queue.shift()!;
        if (visited.has(path)) {
          continue;
        }
        visited.add(path);
        const entries = await desktop.workspace.list(path);
        for (const entry of entries) {
          if (files.length >= 20000) {
            break;
          }
          files.push(toWorkspaceFile(entry));
          if (entry.isDir && visited.size + queue.length < 5000) {
            queue.push(entry.path);
          }
        }
      }
      if (
        generation === workspaceGeneration.current &&
        searchGeneration === workspaceSearchGeneration.current
      ) {
        setWorkspaceSearchFiles(files);
      }
    } catch (error) {
      if (
        generation === workspaceGeneration.current &&
        searchGeneration === workspaceSearchGeneration.current
      ) {
        setWorkspaceError(error instanceof Error ? error.message : "Could not search workspace");
        setWorkspaceSearchFiles([]);
      }
    } finally {
      if (
        generation === workspaceGeneration.current &&
        searchGeneration === workspaceSearchGeneration.current
      ) {
        setWorkspaceSearchLoading(false);
      }
    }
  }, [workspaceFiles, workspaceRoot, workspaceSearchFiles, workspaceSearchLoading]);

  function invalidateWorkspaceSearch() {
    workspaceSearchGeneration.current += 1;
    setWorkspaceSearchFiles(null);
    setWorkspaceSearchLoading(false);
  }

  async function loadWorkspaceDirectory(path: string): Promise<WorkspaceEntry[]> {
    const desktop = window.loomDesktop;
    if (!desktop || desktop.version !== 1) {
      return [];
    }

    const generation = workspaceGeneration.current;
    const entries = await desktop.workspace.list(path);
    if (generation !== workspaceGeneration.current) {
      return [];
    }
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
    const generation = workspaceGeneration.current;
    invalidateWorkspaceSearch();
    try {
      const entries = await window.loomDesktop.workspace.list(".");
      if (generation !== workspaceGeneration.current) {
        return;
      }
      setWorkspaceFiles(entries.map(toWorkspaceFile));
      setWorkspaceError(null);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Could not refresh workspace");
    }
  }

  async function createWorkspaceFile() {
    const path = newFilePath.trim().replaceAll("\\", "/");
    if (!path || workspaceFiles.some((file) => file.path === path)) {
      setCreateFileError(path ? "A file with this path already exists." : "Enter a file path.");
      return;
    }
    try {
      if (window.loomDesktop?.version === 1) {
        await window.loomDesktop.workspace.createFile(path);
      }
      const file = { path, content: "", isDir: false };
      invalidateWorkspaceSearch();
      setWorkspaceFiles((current) => [...current, file]);
      setOpenFiles((current) => [
        ...current,
        { path, content: "", savedContent: "", dirty: false },
      ]);
      activateTab(path);
      setNewFilePath("");
      setCreateFileError(null);
      setCreateFileOpen(false);
      setWorkspaceError(null);
    } catch (error) {
      setCreateFileError(
        error instanceof Error ? error.message : "Could not create workspace file",
      );
    }
  }

  async function createWorkspaceDirectory() {
    const path = newDirectoryPath.trim().replaceAll("\\", "/");
    if (!path) {
      setCreateDirectoryError("Enter a folder path.");
      return;
    }
    if (
      workspaceFiles.some((file) => {
        const existingPath = file.path.replaceAll("\\", "/");
        return existingPath === path || existingPath.startsWith(`${path}/`);
      })
    ) {
      setCreateDirectoryError("An item with this path already exists.");
      return;
    }
    try {
      if (window.loomDesktop?.version === 1) {
        await window.loomDesktop.workspace.createDirectory(path);
      }
      setWorkspaceFiles((current) => [...current, { path, isDir: true }]);
      invalidateWorkspaceSearch();
      setNewDirectoryPath("");
      setCreateDirectoryError(null);
      setCreateDirectoryOpen(false);
      setWorkspaceError(null);
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Could not create workspace folder",
      );
      setCreateDirectoryError(error instanceof Error ? error.message : "Could not create folder");
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
      invalidateWorkspaceSearch();
      setOpenFiles((current) =>
        current.filter((file) => file.path !== path && !file.path.startsWith(`${path}/`)),
      );
      for (const cachedPath of editorStateCache.keys()) {
        if (cachedPath === path || cachedPath.startsWith(`${path}/`)) {
          editorStateCache.delete(cachedPath);
        }
      }
      if (activeTab === path || activeTab.startsWith(`${path}/`)) {
        setEditorHistory(null);
        setActiveTab("chat");
      }
      setDeletePath(null);
      setWorkspaceError(null);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Could not delete workspace item");
      setDeletePath(null);
    }
  }

  async function renameWorkspaceItem() {
    if (!workspacePathToRename) {
      return;
    }
    const name = renameName.trim();
    if (
      !name ||
      name === "." ||
      name === ".." ||
      /[<>:"/\\|?*]/.test(name) ||
      [...name].some((character) => character.charCodeAt(0) < 32) ||
      /[. ]$/.test(name)
    ) {
      setRenameError("Enter a valid file or folder name.");
      return;
    }

    const parent = workspacePathToRename.split("/").slice(0, -1).join("/");
    const nextPath = parent ? `${parent}/${name}` : name;
    if (nextPath === workspacePathToRename) {
      setWorkspacePathToRename(null);
      setRenameError(null);
      return;
    }
    if (workspaceFiles.some((file) => file.path === nextPath)) {
      setRenameError("An item with this name already exists in the folder.");
      return;
    }

    try {
      if (activeTab !== "chat") {
        const state = editorRef.current?.serializeState();
        if (state) {
          editorStateCache.set(activeTab, state);
        }
      }
      if (window.loomDesktop?.version === 1) {
        await window.loomDesktop.workspace.rename(workspacePathToRename, nextPath);
      }
      const movedPath = (path: string) =>
        path === workspacePathToRename || path.startsWith(`${workspacePathToRename}/`)
          ? `${nextPath}${path.slice(workspacePathToRename.length)}`
          : path;
      for (const [cachedPath, state] of [...editorStateCache.entries()]) {
        const movedCachedPath = movedPath(cachedPath);
        if (movedCachedPath !== cachedPath) {
          editorStateCache.delete(cachedPath);
          editorStateCache.set(movedCachedPath, state);
        }
      }
      setWorkspaceFiles((current) =>
        current.map((file) => ({ ...file, path: movedPath(file.path) })),
      );
      setOpenFiles((current) => current.map((file) => ({ ...file, path: movedPath(file.path) })));
      const movedActiveTab = movedPath(activeTab);
      if (movedActiveTab !== activeTab) {
        setEditorHistory(null);
      }
      setActiveTab(movedActiveTab);
      invalidateWorkspaceSearch();
      setWorkspacePathToRename(null);
      setRenameError(null);
      setWorkspaceError(null);
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : "Could not rename workspace item");
    }
  }

  function chooseDirectory(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) {
      return;
    }

    workspaceGeneration.current += 1;
    workspaceSearchGeneration.current += 1;
    setWorkspaceSearchFiles(null);
    setWorkspaceSearchLoading(false);

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
    editorStateCache.clear();
    setEditorHistory(null);
    setActiveTab("chat");
  }

  async function openWorkspaceFile(path: string) {
    const workspaceFile =
      workspaceFiles.find((file) => file.path === path) ??
      workspaceSearchFiles?.find((file) => file.path === path);
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
          : [
              ...current,
              {
                path,
                content,
                savedContent: workspaceFile.content ?? content,
                dirty: workspaceFile.draftContent !== undefined,
              },
            ],
      );
      setWorkspaceFiles((current) =>
        current.map((file) =>
          file.path === path && file.content === undefined ? { ...file, content } : file,
        ),
      );
      activateTab(path);
      setWorkspaceError(null);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Could not read workspace file");
    }
  }

  function updateOpenFile(path: string, content: string) {
    setEditorSaveError((current) => (current?.path === path ? null : current));
    setOpenFiles((current) =>
      current.map((file) =>
        file.path === path ? { ...file, content, dirty: content !== file.savedContent } : file,
      ),
    );
    setWorkspaceFiles((current) =>
      current.map((file) =>
        file.path === path
          ? { ...file, draftContent: content === file.content ? undefined : content }
          : file,
      ),
    );
  }

  function closeOpenFile(path: string) {
    const remainingFiles = openFiles.filter((item) => item.path !== path);
    tabFocusAfterClose.current =
      remainingFiles.length === 0 ? "composer" : activeTab === path ? "chat" : activeTab;
    editorStateCache.delete(path);
    setOpenFiles((current) => current.filter((item) => item.path !== path));
    setWorkspaceFiles((current) =>
      current.map((file) => (file.path === path ? { ...file, draftContent: undefined } : file)),
    );
    if (activeTab === path) {
      setEditorHistory(null);
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
      setEditorSaveError((current) => (current?.path === path ? null : current));

      try {
        if (window.loomDesktop?.version === 1) {
          await window.loomDesktop.workspace.writeFile(path, contentToSave);
        }
        setOpenFiles((current) =>
          current.map((file) =>
            file.path === path
              ? { ...file, savedContent: contentToSave, dirty: file.content !== contentToSave }
              : file,
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
        setEditorSaveError((current) => (current?.path === path ? null : current));
        setWorkspaceError(null);
      } catch (error) {
        setEditorSaveError({
          path,
          message: error instanceof Error ? error.message : "Could not save workspace file",
        });
      }
    },
    [openFiles],
  );

  useEffect(() => {
    const unsubscribe = window.loomDesktop?.onMenuAction?.((action, value) => {
      if (action === "new-chat") {
        startNewConversation();
      }
      if (action === "open-folder") {
        void openWorkspacePicker();
      }
      if (action === "create-workspace") {
        showCreateWorkspaceDialog();
      }
      if (action === "save-all") {
        for (const file of openFiles.filter((item) => item.dirty)) {
          void saveOpenFile(file.path, file.content);
        }
      }
      if (action === "auto-save") {
        setAutoSaveFiles(value === true);
      }
      if (action === "toggle-left") {
        setConversationSidebarOpen((open) => !open);
      }
      if (action === "toggle-right") {
        setWorkspaceExplorerOpen((open) => !open);
      }
      if (action === "about") {
        setAboutOpen(true);
      }
    });
    return unsubscribe;
  }, [
    openFiles,
    openWorkspacePicker,
    saveOpenFile,
    showCreateWorkspaceDialog,
    startNewConversation,
  ]);

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
      void saveOpenFile(file.path);
    }
    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [activeTab, openFiles, saveOpenFile]);

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
    (activeConversationId === NEW_CHAT_ID || !activeConversationId
      ? { id: activeConversationId, title: "", messages: [] }
      : (conversations[0] ?? { id: "", title: "", messages: [] }));
  const messages = activeConversation.messages;
  const followingLatest =
    timelineFollowState.conversationId !== activeConversationId || timelineFollowState.following;
  const setFollowingLatest = (following: boolean) =>
    setTimelineFollowState({ conversationId: activeConversationId, following });
  const activeRunFailed =
    messages.at(-1)?.role === "assistant" && messages.at(-1)?.status === "error";
  const activeRunCancelled =
    messages.at(-1)?.role === "assistant" && messages.at(-1)?.status === "cancelled";
  const approvalRequest = activeConversation.approvalState ?? "hidden";
  const activeFile = openFiles.find((file) => file.path === activeTab);
  const treeData = makeWorkspaceTree(workspaceFiles);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (followingLatest && messageList) {
      messageList.scrollTop = messageList.scrollHeight;
    }
  }, [activeConversation.toolApprovals, activeConversationId, followingLatest, messages]);

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
    <div className="loom-app" data-theme={themeMode}>
      {!desktopMenuMode && (
        <nav className="global-menu-bar" aria-label="Application menu">
          <div className="application-menus flex items-center gap-0.5">
            <Menu
              label="File"
              items={[
                {
                  key: "new-chat",
                  label: "New Chat",
                  disabled: !activeConversation?.messages.length,
                },
                { key: "open-folder", label: "Open Workspace…" },
                { key: "create-workspace", label: "Create Workspace…" },
                { key: "separator", label: "", kind: "divider" },
                {
                  key: "save-all",
                  label: "Save All",
                  disabled: !openFiles.some((file) => file.dirty),
                },
                { key: "auto-save", label: "Auto Save", checked: autoSaveFiles },
              ]}
              onSelect={(key) => {
                if (key === "new-chat") {
                  startNewConversation();
                }
                if (key === "open-folder") {
                  void openWorkspacePicker();
                }
                if (key === "create-workspace") {
                  showCreateWorkspaceDialog();
                }
                if (key === "save-all") {
                  for (const file of openFiles.filter((item) => item.dirty)) {
                    void saveOpenFile(file.path, file.content);
                  }
                }
                if (key === "auto-save") {
                  setAutoSaveFiles((enabled) => !enabled);
                }
              }}
            />
            <Menu
              label="Edit"
              items={[{ key: "select-all", label: "Select All" }]}
              onSelect={() => {
                const selector =
                  activeTab === "chat" ? '[aria-label="Message Loom"]' : ".code-editor";
                if (activeTab === "chat") {
                  document.querySelector<HTMLTextAreaElement>(selector)?.select();
                } else {
                  editorRef.current?.selectAll();
                }
              }}
            />
            <Menu
              label="View"
              items={[
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
              ]}
              onSelect={(key) => {
                if (key === "toggle-left") {
                  setConversationSidebarOpen((open) => !open);
                }
                if (key === "toggle-right") {
                  setWorkspaceExplorerOpen((open) => !open);
                }
              }}
            />
            <Menu
              label="Help"
              items={[{ key: "about", label: "About Loom" }]}
              onSelect={() => setAboutOpen(true)}
            />
          </div>
          {!compactViewport && (
            <div className="flex items-center">
              <IconButton
                type="text"
                variant="ghost"
                aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
                onClick={() => setThemeMode(isDark ? "light" : "dark")}
              >
                <Icon name={isDark ? "sun" : "moon"} />
              </IconButton>
            </div>
          )}
        </nav>
      )}
      <div className="session-tab-bar">
        <div
          ref={sessionTabsRef}
          className="session-tab-list"
          role="tablist"
          aria-label="Session tabs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={
              activeConversationId === NEW_CHAT_ID || !activeConversationId ? "true" : "false"
            }
            aria-label="New chat"
            data-tab-key={NEW_CHAT_ID}
            tabIndex={activeConversationId === NEW_CHAT_ID || !activeConversationId ? 0 : -1}
            className={`session-tab${activeConversationId === NEW_CHAT_ID || !activeConversationId ? " active" : ""}`}
            onClick={startNewConversation}
            onKeyDown={(event) =>
              handleWorkbenchTabKeyDown(event, (key) =>
                key === NEW_CHAT_ID ? startNewConversation() : selectConversation(key),
              )
            }
          >
            New chat
          </button>
          {conversations
            .filter((conversation) => conversation.messages.length > 0)
            .map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                role="tab"
                aria-selected={conversation.id === activeConversationId}
                data-tab-key={conversation.id}
                tabIndex={conversation.id === activeConversationId ? 0 : -1}
                className={`session-tab${conversation.id === activeConversationId ? " active" : ""}`}
                title={conversation.title}
                onClick={() => selectConversation(conversation.id)}
                onKeyDown={(event) =>
                  handleWorkbenchTabKeyDown(event, (key) =>
                    key === NEW_CHAT_ID ? startNewConversation() : selectConversation(key),
                  )
                }
              >
                {conversation.title}
              </button>
            ))}
        </div>
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          className="session-tab-add"
          aria-label="Create chat"
          title="New chat"
          onClick={startNewConversation}
        >
          <span aria-hidden="true">+</span>
        </IconButton>
      </div>
      <ResizablePanelShell
        leftOpen={conversationSidebarOpen}
        rightOpen={workspaceExplorerOpen}
        onExpandLeft={() => setConversationSidebarOpen(true)}
        onExpandRight={() => setWorkspaceExplorerOpen(true)}
        onCollapseLeft={() => setConversationSidebarOpen(false)}
        onCollapseRight={() => setWorkspaceExplorerOpen(false)}
        left={
          <ConversationSidebar
            conversations={conversations}
            activeConversationId={activeConversationId}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectConversation={selectConversation}
            onNewConversation={startNewConversation}
            canCreateConversation
            onDeleteConversation={setConversationToDelete}
            onOpenSettings={() => setSettingsOpen(true)}
            onCollapse={() => setConversationSidebarOpen(false)}
            collapsed={!conversationSidebarOpen}
            onExpand={() => setConversationSidebarOpen(true)}
          />
        }
        center={
          <div className="center-layout">
            <div className="conversation-area" role="main" aria-label="Conversation">
              {activeTab === "chat" && (
                <header className="session-context" aria-label="Session context">
                  <div className="session-context-main">
                    <span className="session-context-title" title={activeConversation.title}>
                      {activeConversation.title || "New chat"}
                    </span>
                  </div>
                  <div className="session-context-actions">
                    <Badge
                      tone={
                        activeRunId ||
                        activeRunFailed ||
                        !gatewayConnected ||
                        pendingApproval?.conversationId === activeConversation.id
                          ? "warning"
                          : "default"
                      }
                    >
                      {pendingApproval?.conversationId === activeConversation.id
                        ? "Needs approval"
                        : activeRunId
                          ? "Running"
                          : activeRunFailed
                            ? "Run failed"
                            : activeRunCancelled
                              ? "Cancelled"
                              : gatewayConnected
                                ? "Ready"
                                : "Provider not configured"}
                    </Badge>
                    <IconButton
                      type="button"
                      variant="ghost"
                      aria-label="Open settings"
                      onClick={() => setSettingsOpen(true)}
                    >
                      <Icon name="settings" />
                    </IconButton>
                  </div>
                </header>
              )}
              {openFiles.length > 0 && (
                <div className="editor-tabs" role="tablist" aria-label="Open views">
                  <button
                    type="button"
                    data-tab-key="chat"
                    role="tab"
                    aria-selected={activeTab === "chat"}
                    tabIndex={activeTab === "chat" ? 0 : -1}
                    onClick={() => activateTab("chat")}
                    onKeyDown={(event) => handleWorkbenchTabKeyDown(event, activateTab)}
                  >
                    <Icon name="message" /> Chat
                  </button>
                  {openFiles.map((file) => (
                    <span className="editor-tab" key={file.path} title={file.path}>
                      <button
                        type="button"
                        data-tab-key={file.path}
                        role="tab"
                        aria-selected={activeTab === file.path}
                        tabIndex={activeTab === file.path ? 0 : -1}
                        onClick={() => activateTab(file.path)}
                        onKeyDown={(event) => handleWorkbenchTabKeyDown(event, activateTab)}
                      >
                        <Icon name="code" /> {file.path.split(/[\\/]/).at(-1)}
                        {file.dirty && <span aria-label="Unsaved changes">●</span>}
                      </button>
                      <IconButton
                        type="text"
                        variant="ghost"
                        size="small"
                        aria-label={`Close ${file.path.split(/[\\/]/).at(-1)}`}
                        onClick={() =>
                          file.dirty ? setCloseFilePrompt(file) : closeOpenFile(file.path)
                        }
                      >
                        <Icon name="close" />
                      </IconButton>
                    </span>
                  ))}
                </div>
              )}

              {activeTab === "chat" ? (
                <div
                  className={`chat-panel${messages.length === 0 ? " chat-panel-empty" : ""}`}
                  role="tabpanel"
                  aria-label="Chat"
                >
                  {messages.length === 0 ? (
                    <section className="welcome" aria-label="Welcome">
                      <div className="welcome-mark welcome-mark-empty">
                        <img src="/loom-avatar.png" alt="" />
                      </div>
                      <Title level={2} className="welcome-title">
                        What are we building today?
                      </Title>
                      <div className="welcome-workspace-actions">
                        <p className="welcome-workspace-hint">
                          Start chatting without a workspace.
                        </p>
                        <div className="welcome-workspace-buttons">
                          <button
                            type="button"
                            className="welcome-workspace-action welcome-workspace-action-primary"
                            onClick={() => void openWorkspacePicker()}
                          >
                            <Icon name="folder" />
                            Open workspace
                          </button>
                          <button
                            type="button"
                            className="welcome-workspace-action welcome-workspace-action-secondary"
                            onClick={showCreateWorkspaceDialog}
                          >
                            <Icon name="folder" />
                            Create workspace
                          </button>
                        </div>
                      </div>
                    </section>
                  ) : (
                    <section
                      ref={messageListRef}
                      className="message-list"
                      aria-label="Messages"
                      role="log"
                      onScroll={(event) => {
                        const list = event.currentTarget;
                        setFollowingLatest(
                          list.scrollHeight - list.clientHeight - list.scrollTop <= 48,
                        );
                      }}
                    >
                      {messages.map((message, index) => {
                        const afterMessageCount = index + 1;
                        const activities = (activeConversation.toolApprovals ?? []).filter(
                          (activity) =>
                            (activity.afterMessageCount ?? messages.length) === afterMessageCount,
                        );

                        return (
                          <Fragment key={`${index}-${message.role}`}>
                            <div
                              className={
                                message.role === "user" ? "user-message" : "assistant-message"
                              }
                            >
                              {message.content ||
                                (message.status === "streaming" ? "Thinking…" : "")}
                              {message.role === "assistant" && message.status && (
                                <span
                                  className={`assistant-message-state ${message.status}`}
                                  role={message.status === "streaming" ? "status" : undefined}
                                >
                                  {message.status === "streaming"
                                    ? "Responding…"
                                    : message.status === "cancelled"
                                      ? "Cancelled"
                                      : "Run failed"}
                                </span>
                              )}
                            </div>
                            {activities.map((activity) => (
                              <ToolActivityCard
                                key={activity.id}
                                activity={activity}
                                actionable={
                                  activity.status === "pending" &&
                                  pendingApproval?.conversationId === activeConversation.id &&
                                  pendingApproval.request.id === activity.id
                                }
                                onRespond={(approved) => void respondToApproval(approved)}
                              />
                            ))}
                          </Fragment>
                        );
                      })}
                      {!gatewayConnected && (
                        <Text type="secondary" className="prototype-note">
                          Configure an OpenAI-compatible provider in Settings to start an agent run.
                        </Text>
                      )}
                      {!gatewayConnected && approvalRequest === "hidden" && (
                        <Button
                          onClick={() => updateApprovalState(getApprovalPreviewState(approvalMode))}
                        >
                          Preview tool approval
                        </Button>
                      )}
                      {approvalRequest === "pending" && !gatewayConnected && (
                        <section className="approval-card" aria-label="Tool approval request">
                          <div>
                            <Text strong>Write src/App.tsx</Text>
                            <Text type="secondary">File write access · this request only</Text>
                          </div>
                          <div className="approval-card-actions">
                            <Button onClick={() => updateApprovalState("rejected")}>Reject</Button>
                            <Button type="primary" onClick={() => updateApprovalState("approved")}>
                              Approve once
                            </Button>
                          </div>
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
                            <Badge tone="warning">Pending review</Badge>
                          </div>
                          <pre className="diff-preview">
                            <code>
                              {
                                "@@ -1 +1 @@\n- What are we building today?\n+ Build something thoughtful."
                              }
                            </code>
                          </pre>
                          <div className="review-actions">
                            <Button onClick={() => updateApprovalState("changes-rejected")}>
                              Reject changes
                            </Button>
                            <Button
                              type="primary"
                              onClick={() => updateApprovalState("changes-accepted")}
                            >
                              Accept changes
                            </Button>
                          </div>
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

                  {messages.length > 0 && !followingLatest && (
                    <div className="timeline-controls">
                      <Button
                        size="sm"
                        className="jump-to-latest"
                        leadingIcon={<Icon name="arrow-up" className="h-3.5 w-3.5 rotate-180" />}
                        onClick={() => {
                          const messageList = messageListRef.current;
                          if (messageList) {
                            messageList.scrollTop = messageList.scrollHeight;
                          }
                          setFollowingLatest(true);
                        }}
                      >
                        Jump to latest
                      </Button>
                    </div>
                  )}

                  <div
                    className={`chat-composer-dock${messages.length > 0 ? " chat-composer-dock-active" : ""}`}
                  >
                    <div
                      className={`composer-wrap${messages.length === 0 ? " composer-wrap-empty" : ""}`}
                    >
                      <TextArea
                        aria-label="Message Loom"
                        placeholder="Ask anything or describe what you would like to build..."
                        autoResize={{ minRows: messages.length === 0 ? 1 : 2, maxRows: 5 }}
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
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
                      <div
                        className={`composer-footer${messages.length === 0 ? " composer-footer-empty" : ""}`}
                      >
                        {messages.length > 0 && (
                          <Text type="secondary">Enter to send · Shift+Enter for a new line</Text>
                        )}
                        {activeRunId ? (
                          <Button
                            type="primary"
                            danger
                            shape="circle"
                            aria-label="Stop run"
                            icon={<Icon name="stop" />}
                            onClick={() => void cancelActiveRun()}
                          />
                        ) : (
                          <Button
                            type="primary"
                            shape="circle"
                            aria-label="Send message"
                            icon={<Icon name="arrow-up" />}
                            disabled={!prompt.trim()}
                            onClick={() => void sendMessage()}
                          />
                        )}
                      </div>
                    </div>
                    <div
                      className="repository-context flex-wrap px-3"
                      role="group"
                      aria-label="Repository context"
                    >
                      <button
                        type="button"
                        className="repository-context-workspace"
                        aria-label="Select workspace"
                        title={workspaceRoot ?? "No workspace open"}
                        onClick={() => void openWorkspacePicker()}
                      >
                        <Icon name="folder" />
                        {workspaceRoot ? workspaceRoot.split(/[\\/]/).at(-1) : "No workspace open"}
                      </button>
                      {workspaceRoot && (
                        <span className="repository-context-separator" aria-hidden="true">
                          /
                        </span>
                      )}
                      {repositoryStatus.state === "loading" ? (
                        <span className="repository-context-git" role="status">
                          Checking Git…
                        </span>
                      ) : repositoryStatus.state === "git" ? (
                        <span
                          className="repository-context-git"
                          aria-live="polite"
                          aria-label={`Current branch: ${repositoryStatus.branch || "Branch unavailable"}`}
                          title={repositoryStatus.branch || "Branch unavailable"}
                        >
                          <Icon name="branch" />
                          {repositoryStatus.branch || "Branch unavailable"}
                        </span>
                      ) : repositoryStatus.state === "error" ? (
                        <span className="repository-context-git" role="status">
                          Git status unavailable
                        </span>
                      ) : (
                        <span
                          className="repository-context-git"
                          aria-live="polite"
                          aria-label="No Git"
                        >
                          <Icon name="monitor" />
                          No Git
                        </span>
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
                      <div className="flex max-w-full flex-wrap items-center gap-1">
                        <IconButton
                          aria-label="Undo"
                          disabled={
                            editorHistory?.path !== activeFile.path || !editorHistory.canUndo
                          }
                          onClick={() => editorRef.current?.undo()}
                        >
                          <Icon name="undo" />
                        </IconButton>
                        <IconButton
                          aria-label="Redo"
                          disabled={
                            editorHistory?.path !== activeFile.path || !editorHistory.canRedo
                          }
                          onClick={() => editorRef.current?.redo()}
                        >
                          <Icon name="redo" />
                        </IconButton>
                        <Button
                          aria-label="Find in file"
                          aria-pressed={editorTool === "find"}
                          onClick={() => setEditorTool(editorTool === "find" ? null : "find")}
                        >
                          Find
                        </Button>
                        <Button
                          aria-label="Replace in file"
                          aria-pressed={editorTool === "replace"}
                          onClick={() => setEditorTool(editorTool === "replace" ? null : "replace")}
                        >
                          Replace
                        </Button>
                        <Button
                          aria-label="Go to line"
                          aria-pressed={editorTool === "goto"}
                          onClick={() => setEditorTool(editorTool === "goto" ? null : "goto")}
                        >
                          Go to line
                        </Button>
                      </div>
                      <Button
                        type="primary"
                        disabled={!activeFile.dirty}
                        onClick={() => void saveOpenFile(activeFile.path)}
                      >
                        {window.loomDesktop?.version === 1 ? "Save" : "Save session changes"}
                      </Button>
                    </div>
                    {editorSaveError?.path === activeFile.path && (
                      <Text role="alert" tone="danger" className="editor-save-error">
                        {editorSaveError.message}
                      </Text>
                    )}
                    {editorTool && (
                      <form
                        className="editor-quick-action"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (editorTool === "find") {
                            const result = editorRef.current?.findNext(findQuery) ?? null;
                            setEditorActionStatus(
                              result
                                ? `Match ${result.match} of ${result.total}`
                                : "No match found",
                            );
                          } else if (editorTool === "goto") {
                            const line = Number(
                              (event.currentTarget.elements.namedItem("line") as HTMLInputElement)
                                .value,
                            );
                            const targetLine = editorRef.current?.goToLine(line) ?? 1;
                            setEditorCursorLine(targetLine);
                            setEditorActionStatus(`Line ${targetLine}`);
                          }
                        }}
                      >
                        {editorTool === "find" ? (
                          <>
                            <TextField
                              key="find"
                              aria-label="Find in file"
                              autoFocus
                              value={findQuery}
                              onChange={(event) => setFindQuery(event.target.value)}
                              placeholder="Find in file"
                              onKeyDown={(event) => {
                                if (event.key === "Escape") {
                                  setEditorTool(null);
                                }
                              }}
                            />
                            <Button type="submit" variant="primary" aria-label="Find next">
                              Find next
                            </Button>
                          </>
                        ) : editorTool === "replace" ? (
                          <>
                            <TextField
                              key="replace-find"
                              aria-label="Find in file"
                              autoFocus
                              value={findQuery}
                              onChange={(event) => setFindQuery(event.target.value)}
                              placeholder="Find in file"
                            />
                            <TextField
                              key="replace-with"
                              aria-label="Replace with"
                              value={replaceQuery}
                              onChange={(event) => setReplaceQuery(event.target.value)}
                              placeholder="Replace with"
                            />
                            <Button
                              aria-label="Replace next"
                              onClick={() => {
                                const replaced =
                                  editorRef.current?.replaceNext(findQuery, replaceQuery) ?? false;
                                setEditorActionStatus(
                                  replaced ? "Match replaced" : "No match found",
                                );
                              }}
                            >
                              Replace
                            </Button>
                            <Button
                              aria-label="Replace all"
                              variant="primary"
                              onClick={() => {
                                const count =
                                  editorRef.current?.replaceAll(findQuery, replaceQuery) ?? 0;
                                setEditorActionStatus(`${count} matches replaced`);
                              }}
                            >
                              Replace all
                            </Button>
                          </>
                        ) : (
                          <>
                            <TextField
                              key="goto"
                              aria-label="Line number"
                              name="line"
                              type="number"
                              min={1}
                              max={activeFile.content.split("\n").length}
                              autoFocus
                              defaultValue={editorCursorLine}
                              onKeyDown={(event) => {
                                if (event.key === "Escape") {
                                  setEditorTool(null);
                                }
                              }}
                            />
                            <Button type="submit" variant="primary">
                              Go
                            </Button>
                          </>
                        )}
                        <Button
                          aria-label="Close editor action"
                          onClick={() => setEditorTool(null)}
                        >
                          Close
                        </Button>
                      </form>
                    )}
                    <div className="code-editor-shell">
                      <Suspense fallback={<div role="status">Loading editor…</div>}>
                        <CodeEditor
                          ref={editorRef}
                          label={`Editor content ${activeFile.path}`}
                          path={activeFile.path}
                          value={activeFile.content}
                          onChange={(content) => updateOpenFile(activeFile.path, content)}
                          onCursorChange={setEditorCursorLine}
                          stateCache={editorStateCache}
                          onHistoryChange={(canUndo, canRedo) =>
                            setEditorHistory({ path: activeFile.path, canUndo, canRedo })
                          }
                        />
                      </Suspense>
                    </div>
                    <Text className="editor-cursor" role="status" aria-label="Editor cursor">
                      Line {editorCursorLine}
                      {editorActionStatus ? ` · ${editorActionStatus}` : ""}
                    </Text>
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
            </div>
          </div>
        }
        right={
          <WorkspaceExplorer
            open={workspaceExplorerOpen}
            workspaceRoot={workspaceRoot}
            activeFilePath={activeFile?.path ?? null}
            gatewayConnected={gatewayConnected}
            workspaceError={workspaceError}
            treeData={treeData}
            workspaceFiles={workspaceFiles}
            workspaceSearchFiles={workspaceSearchFiles}
            workspaceSearchLoading={workspaceSearchLoading}
            onSearchWorkspace={searchWorkspaceFiles}
            onOpenFolder={() => void openWorkspacePicker()}
            onRefresh={() => void refreshWorkspace()}
            onCreateFile={(initialPath = "") => {
              setNewFilePath(initialPath);
              setCreateFileError(null);
              setCreateFileOpen(true);
            }}
            onCreateDirectory={(initialPath = "") => {
              setNewDirectoryPath(initialPath);
              setCreateDirectoryError(null);
              setCreateDirectoryOpen(true);
            }}
            onDelete={setDeletePath}
            onRename={(path) => {
              setWorkspacePathToRename(path);
              setRenameName(path.split(/[\\/]/).at(-1) ?? path);
              setRenameError(null);
            }}
            onOpenFile={(path) => void openWorkspaceFile(path)}
            onLoadDirectory={loadWorkspaceDirectory}
            onCollapse={() => setWorkspaceExplorerOpen(false)}
            onExpand={() => setWorkspaceExplorerOpen(true)}
          />
        }
      />
      <Dialog title="About Loom" open={aboutOpen} onClose={() => setAboutOpen(false)} hideActions>
        <Text>Loom is a local-first coding workspace with an OpenAI-compatible agent runtime.</Text>
      </Dialog>
      <Dialog
        title="Create a workspace"
        open={createWorkspaceOpen}
        onClose={() => {
          setCreateWorkspaceOpen(false);
          setCreateWorkspaceError(null);
        }}
        onConfirm={submitCreateWorkspace}
        confirmLabel="Choose location"
      >
        <div className="grid gap-3">
          <Text as="p" className="m-0">
            Name the workspace, then choose where its new folder should be created.
          </Text>
          <TextField
            autoFocus
            aria-label="Workspace name"
            placeholder="my-workspace"
            value={newWorkspaceName}
            aria-describedby={createWorkspaceError ? "create-workspace-error" : undefined}
            aria-invalid={createWorkspaceError ? true : undefined}
            onChange={(event) => {
              setNewWorkspaceName(event.target.value);
              setCreateWorkspaceError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                submitCreateWorkspace();
              }
            }}
          />
          {createWorkspaceError && (
            <Text id="create-workspace-error" role="alert" tone="danger" as="p" className="m-0">
              {createWorkspaceError}
            </Text>
          )}
        </div>
      </Dialog>
      <Dialog
        title="Delete conversation?"
        open={conversationToDelete !== null}
        onClose={() => setConversationToDelete(null)}
        onConfirm={deleteConversation}
        confirmLabel="Delete chat"
        confirmVariant="danger"
      >
        This removes the conversation and its messages from this app.
      </Dialog>
      <Dialog
        title="Create a file"
        open={createFileOpen}
        onClose={() => setCreateFileOpen(false)}
        onConfirm={() => void createWorkspaceFile()}
        confirmLabel="Create and open"
      >
        <div className="grid gap-2">
          <TextField
            autoFocus
            aria-label="New file path"
            aria-describedby={createFileError ? "create-file-error" : undefined}
            aria-invalid={createFileError ? true : undefined}
            placeholder="src/new-file.ts"
            value={newFilePath}
            onChange={(event) => {
              setNewFilePath(event.target.value);
              setCreateFileError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void createWorkspaceFile();
              }
            }}
          />
          {createFileError && (
            <Text id="create-file-error" role="alert" tone="danger" as="p" className="m-0">
              {createFileError}
            </Text>
          )}
        </div>
      </Dialog>
      <Dialog
        title="Create a folder"
        open={createDirectoryOpen}
        onClose={() => {
          setCreateDirectoryOpen(false);
          setCreateDirectoryError(null);
        }}
        onConfirm={() => void createWorkspaceDirectory()}
        confirmLabel="Create folder"
      >
        <TextField
          autoFocus
          aria-label="New folder path"
          placeholder="src/components"
          value={newDirectoryPath}
          aria-describedby={createDirectoryError ? "create-directory-error" : undefined}
          aria-invalid={createDirectoryError ? true : undefined}
          onChange={(event) => {
            setNewDirectoryPath(event.target.value);
            setCreateDirectoryError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void createWorkspaceDirectory();
            }
          }}
        />
        {createDirectoryError && (
          <Text id="create-directory-error" role="alert" tone="danger" as="p" className="m-0 mt-2">
            {createDirectoryError}
          </Text>
        )}
      </Dialog>
      <Dialog
        title="Delete workspace item?"
        open={deletePath !== null}
        onClose={() => setDeletePath(null)}
        onConfirm={() => deletePath && void deleteWorkspacePath(deletePath)}
        confirmLabel="Delete"
        confirmVariant="danger"
      >
        {deletePath}
      </Dialog>
      <Dialog
        title="Rename workspace item"
        open={workspacePathToRename !== null}
        onClose={() => {
          setWorkspacePathToRename(null);
          setRenameError(null);
        }}
        onConfirm={() => void renameWorkspaceItem()}
        confirmLabel="Rename"
      >
        <div className="grid gap-3">
          <TextField
            autoFocus
            aria-label="New item name"
            value={renameName}
            onChange={(event) => setRenameName(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void renameWorkspaceItem();
              }
            }}
          />
          {renameError && <Text role="alert">{renameError}</Text>}
        </div>
      </Dialog>
      <Dialog
        title="Discard unsaved changes?"
        open={closeFilePrompt !== null}
        onClose={() => setCloseFilePrompt(null)}
        onConfirm={() => {
          if (closeFilePrompt) {
            closeOpenFile(closeFilePrompt.path);
          }
          setCloseFilePrompt(null);
        }}
        confirmLabel="Discard changes"
        confirmVariant="danger"
        cancelLabel="Keep editing"
      >
        The changes in {closeFilePrompt?.path} have not been saved.
      </Dialog>
      <input
        ref={directoryInputRef}
        aria-label="Workspace folder input"
        className="directory-input"
        type="file"
        multiple
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        onChange={(event) => chooseDirectory(event.currentTarget.files)}
      />
      {settingsOpen && (
        <div
          className="settings-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSettingsOpen(false);
            }
          }}
        >
          <section
            ref={settingsScopeRef}
            className="settings-window"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            onKeyDown={handleSettingsKeyDown}
          >
            <header className="settings-header">
              <div>
                <Text type="secondary">LOOM PREFERENCES</Text>
                <Title level={2}>Settings</Title>
              </div>
              <IconButton
                type="button"
                variant="ghost"
                aria-label="Close settings"
                onClick={() => setSettingsOpen(false)}
              >
                <Icon name="close" />
              </IconButton>
            </header>
            <div className="settings-layout">
              <nav className="settings-categories" aria-label="Settings categories">
                <span className="settings-category-heading">GENERAL</span>
                {["Providers", "Models", "Appearance", "Keybinds"].map((category) => (
                  <button
                    key={category}
                    className={`settings-category${settingsCategory === category ? " active" : ""}`}
                    type="button"
                    aria-current={settingsCategory === category ? "page" : undefined}
                    onClick={() => setSettingsCategory(category)}
                    onKeyDown={(event) => handleSettingsCategoryKeyDown(event, setSettingsCategory)}
                  >
                    {category}
                  </button>
                ))}
                <span className="settings-category-heading">WORKSPACE</span>
                {["Permissions", "Extensions", "About"].map((category) => (
                  <button
                    key={category}
                    className={`settings-category${settingsCategory === category ? " active" : ""}`}
                    type="button"
                    aria-current={settingsCategory === category ? "page" : undefined}
                    onClick={() => setSettingsCategory(category)}
                    onKeyDown={(event) => handleSettingsCategoryKeyDown(event, setSettingsCategory)}
                  >
                    {category}
                  </button>
                ))}
              </nav>
              <div className="settings-content">
                {settingsCategory === "Providers" ? (
                  <>
                    <h3>Providers</h3>
                    <p className="settings-description">
                      Configure an OpenAI-compatible provider to power your conversations.
                    </p>
                    <Tabs
                      defaultKey="gateway"
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
                                Connect to an OpenAI-compatible API or gateway. The API key is
                                encrypted with OS storage in the desktop app.
                              </Text>
                              <label htmlFor="gateway-url">Base URL</label>
                              <TextField
                                id="gateway-url"
                                value={gatewayBaseUrl}
                                onChange={(event) => setGatewayBaseUrl(event.target.value)}
                              />
                              <label htmlFor="gateway-model">Gateway model</label>
                              <TextField
                                id="gateway-model"
                                value={gatewayModel}
                                onChange={(event) => setGatewayModel(event.target.value)}
                              />
                              <label htmlFor="gateway-api-key">API key</label>
                              <TextField
                                type="password"
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
                                <span
                                  className={`status-dot${gatewayConnected ? " connected" : ""}`}
                                />
                                {gatewayConnected
                                  ? `Connected · ${gatewayModel}`
                                  : "Provider not configured"}
                              </div>
                              <Button type="primary" onClick={() => void connectGateway()}>
                                {gatewayConnected ? "Save provider settings" : "Connect provider"}
                              </Button>
                            </section>
                          ),
                        },
                      ]}
                    />
                  </>
                ) : (
                  <section
                    className="settings-placeholder"
                    aria-label={`${settingsCategory} settings`}
                  >
                    <h3>{settingsCategory}</h3>
                    <p>
                      {settingsCategory === "Models"
                        ? "Choose the model and reasoning effort used for new runs."
                        : settingsCategory === "Appearance"
                          ? "Choose how Loom looks and how the chat workspace is arranged."
                          : settingsCategory === "Keybinds"
                            ? "Keyboard shortcuts for chat and workspace actions."
                            : settingsCategory === "Permissions"
                              ? "Review the actions your agent can request in the active workspace."
                              : settingsCategory === "Extensions"
                                ? "Manage optional tools and integrations for your agent."
                                : "Application version and workspace information."}
                    </p>
                    {settingsCategory === "Appearance" && (
                      <div className="settings-appearance-controls">
                        <Button
                          type="primary"
                          onClick={() => setThemeMode(isDark ? "light" : "dark")}
                        >
                          Switch to {isDark ? "light" : "dark"} theme
                        </Button>
                        <div className="settings-toggle-list" aria-label="Workbench layout">
                          <label className="settings-toggle-row">
                            <span>
                              <strong>Conversations</strong>
                              <small>Show the session list</small>
                            </span>
                            <input
                              type="checkbox"
                              aria-label="Show conversations"
                              checked={conversationSidebarOpen}
                              onChange={(event) => setConversationSidebarOpen(event.target.checked)}
                            />
                          </label>
                          <label className="settings-toggle-row">
                            <span>
                              <strong>Workspace explorer</strong>
                              <small>Show workspace files beside chat</small>
                            </span>
                            <input
                              type="checkbox"
                              aria-label="Show workspace explorer"
                              checked={workspaceExplorerOpen}
                              onChange={(event) => setWorkspaceExplorerOpen(event.target.checked)}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                    {settingsCategory === "Models" && (
                      <label className="settings-select-label" htmlFor="settings-default-model">
                        Default model
                        <select
                          id="settings-default-model"
                          value={selectedModel}
                          onChange={(event) => setSelectedModel(event.target.value)}
                        >
                          {MODEL_OPTIONS.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {settingsCategory === "Permissions" && (
                      <label className="settings-select-label">
                        Approval policy
                        <select
                          value={approvalMode}
                          onChange={(event) => setApprovalMode(event.target.value as ApprovalMode)}
                        >
                          <option value="ask">Ask before every tool</option>
                          <option value="workspace">Workspace access</option>
                          <option value="auto">Automatic</option>
                        </select>
                      </label>
                    )}
                    {settingsCategory === "About" && (
                      <Text type="secondary">Loom desktop agent · v1</Text>
                    )}
                  </section>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
      <Dialog
        title={extensionDialog === "mcp" ? "Add MCP server" : "Add plugin"}
        open={extensionDialog !== null}
        onClose={() => setExtensionDialog(null)}
        onConfirm={addExtension}
        confirmLabel={extensionDialog === "mcp" ? "Add MCP server" : "Add plugin"}
      >
        <div className="settings-section">
          <Text type="secondary">
            Preview only. Connections and plugin loading are not enabled until the runtime is
            integrated.
          </Text>
          <TextField
            aria-label={extensionDialog === "mcp" ? "MCP server name" : "Plugin name"}
            placeholder={extensionDialog === "mcp" ? "Server name" : "Plugin name"}
            value={extensionName}
            onChange={(event) => setExtensionName(event.target.value)}
          />
        </div>
      </Dialog>
    </div>
  );
}

export default App;
