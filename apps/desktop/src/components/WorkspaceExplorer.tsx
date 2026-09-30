import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { WorkspaceEntry } from "../../shared/desktopApi";
import { Button, IconButton } from "./ui";
import { TextField } from "./ui";

export type WorkspaceTreeNode = {
  key: string;
  title: string;
  isLeaf?: boolean;
  children?: WorkspaceTreeNode[];
};

type Props = {
  open: boolean;
  workspaceRoot: string | null;
  gatewayConnected: boolean;
  workspaceError: string | null;
  treeData: WorkspaceTreeNode[];
  workspaceFiles: { path: string }[];
  activeFilePath: string | null;
  workspaceSearchFiles: { path: string; isDir?: boolean }[] | null;
  workspaceSearchLoading: boolean;
  onSearchWorkspace(): void;
  onOpenFolder(): void;
  onRefresh(): void;
  onCreateFile(initialPath?: string): void;
  onCreateDirectory(initialPath?: string): void;
  onDelete(path: string): void;
  onRename(path: string): void;
  onOpenFile(path: string): void;
  onCollapse(): void;
  onExpand(): void;
  onLoadDirectory(path: string): Promise<WorkspaceEntry[]>;
};

type MenuState = {
  root: string | null;
  path: string;
  isLeaf: boolean;
  x: number;
  y: number;
} | null;
type TreeState = {
  root: string | null;
  expanded: Set<string>;
  loaded: Set<string>;
  loading: Set<string>;
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <IconButton aria-label={label} variant="ghost" onClick={onClick}>
      {children}
    </IconButton>
  );
}

export function WorkspaceExplorer(props: Props) {
  const [treeState, setTreeState] = useState<TreeState>(() => ({
    root: props.workspaceRoot,
    expanded: new Set(),
    loaded: new Set(),
    loading: new Set(),
  }));
  const [menu, setMenu] = useState<MenuState>(null);
  const [query, setQuery] = useState("");
  const workspaceRootRef = useRef(props.workspaceRoot);
  const treeRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLElement | null>(null);
  const hadActiveMenuRef = useRef(false);
  const restoreMenuFocusRef = useRef(false);
  useLayoutEffect(() => {
    workspaceRootRef.current = props.workspaceRoot;
  }, [props.workspaceRoot]);
  const activeMenu = menu?.root === props.workspaceRoot ? menu : null;
  useLayoutEffect(() => {
    if (activeMenu) {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
      hadActiveMenuRef.current = true;
    } else if (hadActiveMenuRef.current && restoreMenuFocusRef.current) {
      hadActiveMenuRef.current = false;
      restoreMenuFocusRef.current = false;
      menuTriggerRef.current?.focus();
    } else if (hadActiveMenuRef.current) {
      hadActiveMenuRef.current = false;
    }
  }, [activeMenu]);
  const currentTree =
    treeState.root === props.workspaceRoot
      ? treeState
      : {
          root: props.workspaceRoot,
          expanded: new Set<string>(),
          loaded: new Set<string>(),
          loading: new Set<string>(),
        };
  const { expanded, loaded, loading } = currentTree;
  const visibleTreePaths = props.treeData.flatMap((node) => {
    const collectVisiblePaths = (entry: WorkspaceTreeNode): string[] => {
      const path = String(entry.key);
      return [
        path,
        ...(!entry.isLeaf && expanded.has(path)
          ? (entry.children ?? []).flatMap(collectVisiblePaths)
          : []),
      ];
    };
    return collectVisiblePaths(node);
  });
  const firstTreeTabStop = visibleTreePaths.includes(props.activeFilePath ?? "")
    ? props.activeFilePath
    : visibleTreePaths[0];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const searchResults = (props.workspaceSearchFiles ?? []).filter(
    (file) => !file.isDir && file.path.toLocaleLowerCase().includes(normalizedQuery),
  );

  const onSearchWorkspace = props.onSearchWorkspace;
  useEffect(() => {
    if (normalizedQuery) {
      onSearchWorkspace();
    }
  }, [normalizedQuery, onSearchWorkspace]);

  function updateTree(update: (state: TreeState) => TreeState) {
    setTreeState((state) => update(state.root === props.workspaceRoot ? state : currentTree));
  }

  async function toggleDirectory(path: string) {
    if (expanded.has(path)) {
      updateTree((current) => ({
        ...current,
        expanded: new Set([...current.expanded].filter((entry) => entry !== path)),
      }));
      return;
    }
    updateTree((current) => ({ ...current, expanded: new Set(current.expanded).add(path) }));
    if (loaded.has(path) || loading.has(path)) {
      return;
    }
    const requestedRoot = props.workspaceRoot;
    updateTree((current) => ({ ...current, loading: new Set(current.loading).add(path) }));
    try {
      await props.onLoadDirectory(path);
      if (workspaceRootRef.current === requestedRoot) {
        updateTree((current) => ({ ...current, loaded: new Set(current.loaded).add(path) }));
      }
    } finally {
      if (workspaceRootRef.current === requestedRoot) {
        updateTree((current) => ({
          ...current,
          loading: new Set([...current.loading].filter((entry) => entry !== path)),
        }));
      }
    }
  }

  function openContextMenu(event: MouseEvent, path: string, isLeaf: boolean) {
    event.preventDefault();
    const treeItem = event.currentTarget.closest<HTMLElement>("[data-tree-path]");
    menuTriggerRef.current = treeItem;
    setMenu({ root: props.workspaceRoot, path, isLeaf, x: event.clientX, y: event.clientY });
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      restoreMenuFocusRef.current = true;
      setMenu(null);
      return;
    }
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex =
      event.key === "ArrowDown"
        ? (index + 1) % items.length
        : event.key === "ArrowUp"
          ? (index - 1 + items.length) % items.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : -1;
    if (nextIndex >= 0) {
      event.preventDefault();
      items[nextIndex]?.focus();
    }
  }

  function focusTreePath(path: string | undefined) {
    if (!path) {
      return;
    }
    const target = Array.from(
      treeRef.current?.querySelectorAll<HTMLDivElement>("[data-tree-path]") ?? [],
    ).find((button) => button.dataset.treePath === path);
    target?.focus();
  }

  function handleTreeItemKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    path: string,
    isLeaf: boolean,
    isExpanded: boolean,
  ) {
    const visibleItems = Array.from(
      treeRef.current?.querySelectorAll<HTMLDivElement>("[data-tree-path]") ?? [],
    );
    if (event.target !== event.currentTarget) {
      return;
    }
    const currentIndex = visibleItems.indexOf(event.currentTarget);
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (isLeaf) {
        props.onOpenFile(path);
      } else {
        void toggleDirectory(path);
      }
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex =
        event.key === "ArrowDown"
          ? Math.min(currentIndex + 1, visibleItems.length - 1)
          : Math.max(0, currentIndex - 1);
      visibleItems[nextIndex]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      visibleItems[event.key === "Home" ? 0 : visibleItems.length - 1]?.focus();
    } else if (event.key === "ArrowRight" && !isLeaf) {
      event.preventDefault();
      if (!isExpanded) {
        void toggleDirectory(path);
      } else {
        focusTreePath(
          visibleTreePaths.find(
            (entry) =>
              entry.startsWith(`${path}/`) && entry.slice(path.length + 1).indexOf("/") === -1,
          ),
        );
      }
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (!isLeaf && isExpanded) {
        void toggleDirectory(path);
      } else {
        focusTreePath(path.split("/").slice(0, -1).join("/"));
      }
    }
  }

  function runMenuAction(action: "new-file" | "new-folder" | "delete" | "rename") {
    if (!activeMenu) {
      return;
    }
    const parent = activeMenu.isLeaf
      ? activeMenu.path.split("/").slice(0, -1).join("/")
      : activeMenu.path;
    const prefix = parent && parent !== "." ? `${parent}/` : "";
    if (action === "new-file") {
      props.onCreateFile(prefix);
    } else if (action === "new-folder") {
      props.onCreateDirectory(prefix);
    } else if (action === "rename") {
      props.onRename(activeMenu.path);
    } else {
      props.onDelete(activeMenu.path);
    }
    setMenu(null);
  }

  function renderNodes(nodes: WorkspaceTreeNode[], depth = 0): ReactNode {
    return nodes.map((node) => {
      const path = String(node.key);
      const isLeaf = node.isLeaf === true;
      const isExpanded = expanded.has(path);
      return (
        <div
          role="treeitem"
          aria-label={node.title}
          aria-current={props.activeFilePath === path ? "page" : undefined}
          aria-expanded={isLeaf ? undefined : isExpanded}
          aria-level={depth + 1}
          tabIndex={path === firstTreeTabStop ? 0 : -1}
          data-tree-path={path}
          className="workspace-treeitem min-w-0 rounded-md"
          key={path}
          onKeyDown={(event) => handleTreeItemKeyDown(event, path, isLeaf, isExpanded)}
          onContextMenu={(event) => openContextMenu(event, path, isLeaf)}
        >
          <div className="workspace-treeitem-row group flex min-w-0 items-center gap-1 rounded-md pr-1 hover:bg-[var(--loom-panel-raised)] focus-within:bg-[var(--loom-panel-raised)]">
            {!isLeaf ? (
              <button
                type="button"
                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.title}`}
                tabIndex={-1}
                className="flex h-7 w-6 shrink-0 items-center justify-center rounded text-[var(--loom-muted)] hover:text-[var(--loom-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500"
                onClick={() => void toggleDirectory(path)}
              >
                <span aria-hidden="true" className="text-xs">
                  {isExpanded ? "⌄" : "›"}
                </span>
              </button>
            ) : (
              <span className="w-6 shrink-0" />
            )}
            <button
              type="button"
              tabIndex={-1}
              className={`flex h-7 min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-md text-left text-[13px] hover:text-[var(--loom-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 ${props.activeFilePath === path ? "bg-[var(--loom-panel-raised)] text-[var(--loom-text)] ring-1 ring-inset ring-[var(--loom-line)]" : "text-[var(--loom-muted)]"}`}
              onClick={() => (isLeaf ? props.onOpenFile(path) : void toggleDirectory(path))}
              style={{ paddingLeft: `${depth * 12}px` }}
            >
              <Icon>
                {isLeaf ? (
                  <path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" />
                ) : (
                  <path d="M3 6h7l2 2h9v11H3z" />
                )}
              </Icon>
              <span className="truncate">{node.title}</span>
            </button>
            <button
              type="button"
              aria-label={`Actions for ${node.title}`}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--loom-muted)] opacity-0 hover:bg-[var(--loom-line)] group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500"
              onClick={(event) => openContextMenu(event, path, isLeaf)}
            >
              ···
            </button>
          </div>
          {!isLeaf && isExpanded && (
            <div role="group" aria-label={`${node.title} contents`}>
              {loading.has(path) ? (
                <div className="py-1 pl-8 text-xs text-[var(--loom-muted)]">Loading…</div>
              ) : (
                renderNodes(node.children ?? [], depth + 1)
              )}
            </div>
          )}
        </div>
      );
    });
  }

  return (
    <aside
      aria-label={props.open ? "Workspace explorer" : "Workspace tools"}
      className={`explorer-panel flex h-full min-w-0 flex-col overflow-hidden bg-[var(--loom-panel)] ${props.open ? "" : "explorer-panel-collapsed"}`}
    >
      <div className="explorer-heading flex min-h-9 items-center gap-1">
        {props.open && (
          <strong className="mr-auto min-w-0 truncate px-2 text-xs font-semibold tracking-wide">
            Workspace explorer
          </strong>
        )}
        <ActionButton
          label={props.open ? "Hide workspace explorer" : "Show workspace explorer"}
          onClick={props.open ? props.onCollapse : props.onExpand}
        >
          <Icon>
            <path d={props.open ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"} />
          </Icon>
        </ActionButton>
        {props.open && props.workspaceRoot && (
          <>
            <ActionButton label="New file" onClick={() => props.onCreateFile()}>
              <Icon>
                <path d="M12 5v14m-7-7h14" />
              </Icon>
            </ActionButton>
            <ActionButton label="Refresh workspace files" onClick={props.onRefresh}>
              <Icon>
                <path d="M20 7v5h-5M4 17v-5h5m-3-4a7 7 0 0 1 12-1l2 3M4 13l2 3a7 7 0 0 0 12-1" />
              </Icon>
            </ActionButton>
            <ActionButton label="Open another workspace" onClick={props.onOpenFolder}>
              <Icon>
                <path d="M3 6h7l2 2h9v11H3zM12 13v5m-2.5-2.5h5" />
              </Icon>
            </ActionButton>
          </>
        )}
      </div>
      {!props.open ? (
        <>
          <ActionButton label="Show file explorer" onClick={props.onExpand}>
            <Icon>
              <path d="M3 4h18v16H3zM9 4v16" />
            </Icon>
          </ActionButton>
          <ActionButton
            label={props.workspaceRoot ? "Open another workspace" : "Open workspace"}
            onClick={props.onOpenFolder}
          >
            <Icon>
              <path d="M3 6h7l2 2h9v11H3z" />
            </Icon>
          </ActionButton>
        </>
      ) : props.workspaceRoot ? (
        <div
          className="workspace-tree flex min-h-0 flex-1 flex-col overflow-auto px-2"
          aria-label="Workspace files"
        >
          {props.workspaceError && (
            <div className="workspace-error" role="alert">
              {props.workspaceError}
            </div>
          )}
          <button
            type="button"
            className="flex h-8 items-center gap-2 truncate rounded-md px-2 text-left text-xs font-semibold text-[var(--loom-text)] hover:bg-[var(--loom-panel-raised)]"
            aria-label="Workspace root actions"
            onContextMenu={(event) => openContextMenu(event, ".", false)}
          >
            <Icon>
              <path d="M3 6h7l2 2h9v11H3z" />
            </Icon>
            <span className="truncate">{props.workspaceRoot}</span>
          </button>
          <TextField
            aria-label="Search workspace files"
            className="my-2 h-8 py-1.5"
            placeholder="Search files by name or path"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {normalizedQuery ? (
            <div role="list" aria-label="Workspace search results" className="min-w-0">
              {(props.workspaceSearchLoading || props.workspaceSearchFiles === null) && (
                <div role="status" className="px-2 py-2 text-xs text-[var(--loom-muted)]">
                  Searching workspace…
                </div>
              )}
              {!props.workspaceSearchLoading &&
                props.workspaceSearchFiles !== null &&
                searchResults.length === 0 && (
                  <div role="status" className="px-2 py-2 text-xs text-[var(--loom-muted)]">
                    No files match “{query.trim()}”.
                  </div>
                )}
              {searchResults.map((file) => (
                <div role="listitem" key={file.path}>
                  <button
                    type="button"
                    aria-label={`Open ${file.path}`}
                    aria-current={props.activeFilePath === file.path ? "page" : undefined}
                    className={`flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-xs hover:text-[var(--loom-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 ${props.activeFilePath === file.path ? "bg-[var(--loom-panel-raised)] text-[var(--loom-text)] ring-1 ring-inset ring-[var(--loom-line)]" : "text-[var(--loom-muted)] hover:bg-[var(--loom-panel-raised)]"}`}
                    onClick={() => props.onOpenFile(file.path)}
                  >
                    <Icon>
                      <path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" />
                    </Icon>
                    <span className="min-w-0 truncate">{file.path}</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div ref={treeRef} role="tree" aria-label="Workspace files" className="mt-1 min-w-0">
              {renderNodes(props.treeData)}
            </div>
          )}
        </div>
      ) : (
        <div className="explorer-empty flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center text-sm text-[var(--loom-muted)]">
          <Icon>
            <path d="M7 3h7l5 5v13H7zM14 3v5h5" />
          </Icon>
          <span>No workspace open</span>
          <Button onClick={props.onOpenFolder}>Open workspace</Button>
        </div>
      )}
      {props.open && (
        <div className="gateway-status flex items-start gap-2 border-t border-[var(--loom-line)] p-3 text-xs">
          <span className={`status-dot${props.gatewayConnected ? " connected" : ""}`} />
          <div className="min-w-0">
            <strong className="block text-[var(--loom-text)]">
              {props.gatewayConnected ? "Provider connected" : "Provider required"}
            </strong>
            <span className="text-[var(--loom-muted)]">
              {props.gatewayConnected
                ? "OpenAI-compatible provider"
                : "Configure a provider to start an agent run"}
            </span>
          </div>
        </div>
      )}
      {activeMenu && (
        <>
          <button
            className="fixed inset-0 z-20 cursor-default"
            aria-label="Close file actions"
            onClick={() => setMenu(null)}
          />
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-30 min-w-40 rounded-lg border border-[var(--loom-line)] bg-[var(--loom-panel)] p-1 shadow-xl"
            style={{ left: activeMenu.x, top: activeMenu.y }}
            onKeyDown={handleMenuKeyDown}
          >
            <Button
              role="menuitem"
              variant="ghost"
              className="!h-9 !w-full !justify-start rounded px-3 text-left text-sm"
              onClick={() => runMenuAction("new-file")}
            >
              New File
            </Button>
            <Button
              role="menuitem"
              variant="ghost"
              className="!h-9 !w-full !justify-start rounded px-3 text-left text-sm"
              onClick={() => runMenuAction("new-folder")}
            >
              New Folder
            </Button>
            {activeMenu.path !== "." && (
              <Button
                role="menuitem"
                variant="ghost"
                className="!h-9 !w-full !justify-start rounded px-3 text-left text-sm"
                onClick={() => runMenuAction("rename")}
              >
                Rename
              </Button>
            )}
            {activeMenu.path !== "." && (
              <Button
                role="menuitem"
                variant="ghost"
                className="!h-9 !w-full !justify-start rounded px-3 text-left text-sm !text-red-400"
                onClick={() => runMenuAction("delete")}
              >
                Delete
              </Button>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
