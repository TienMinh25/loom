import { beforeEach, test, expect, describe, mock } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "./App";
import { ConversationSidebar } from "./components/ConversationSidebar";

beforeEach(() => {
  localStorage.setItem("loom:left-panel-open:v1", "true");
  localStorage.setItem("loom:right-panel-open:v1", "true");
  localStorage.setItem("loom:panel-widths:v1", "[248,280]");
});

function expandTreeFolder(name: string) {
  fireEvent.click(screen.getByRole("button", { name: `Expand ${name}` }));
}

async function enterEditorText(editor: HTMLElement, value: string) {
  const content = editor.classList.contains("cm-content")
    ? editor
    : editor.querySelector<HTMLElement>(".cm-content");
  if (!content) {
    throw new Error("Editor content surface was not rendered");
  }
  await act(async () => {
    content.textContent = value;
    fireEvent.input(content, { inputType: "insertText", data: value });
    await Promise.resolve();
  });
}

function readEditorText(editor: HTMLElement) {
  const lines = [...editor.querySelectorAll(".cm-line")];
  return lines.length ? lines.map((line) => line.textContent ?? "").join("\n") : editor.textContent;
}

function selectWorkspaceFiles() {
  const files = [
    new File(["function App() {\n  return <main>Hello, Loom</main>;\n}"], "App.tsx"),
    new File(["createRoot(root).render(<App />);"], "main.tsx"),
    new File(["# sample-project\n\nA coding workspace."], "README.md"),
  ];
  for (const file of files) {
    Object.defineProperty(file, "webkitRelativePath", {
      value: `sample-project/${file.name === "App.tsx" || file.name === "main.tsx" ? "src/" : ""}${file.name}`,
    });
  }
  fireEvent.change(screen.getByLabelText("Workspace folder input"), {
    target: { files },
  });
}

describe("MainUI testing", () => {
  test("shows the Loom workspace and prompt composer", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "What are we building today?" }).textContent).toBe(
      "What are we building today?",
    );
    expect(screen.getByRole("textbox", { name: "Message Loom" }).getAttribute("placeholder")).toBe(
      "Ask anything or describe what you would like to build...",
    );
  });

  test("keeps the empty-chat composer compact and expands for multiline prompts", () => {
    render(<App />);

    const composer = screen.getByRole("textbox", { name: "Message Loom" });
    expect(composer.getAttribute("rows")).toBe("1");
    expect((composer as HTMLTextAreaElement).style.height).toBe("40px");
    expect(screen.queryByText("Enter to send · Shift+Enter for a new line")).toBeNull();
    expect(document.querySelector(".composer-footer-empty")).toBeTruthy();

    fireEvent.change(composer, { target: { value: "first line\nsecond line" } });
    expect((composer as HTMLTextAreaElement).style.height).toBe("64px");
  });

  test("hides the textarea scrollbar chrome without disabling composer scrolling", () => {
    const stylesheet = readFileSync(fileURLToPath(new URL("./App.css", import.meta.url)), "utf8");
    const scrollbarRule = stylesheet.match(
      /\.composer-wrap textarea::?-webkit-scrollbar\s*\{([^}]*)\}/,
    );

    expect(scrollbarRule?.[1]).toMatch(/display:\s*none/);
  });

  test("starts a fresh chat with the workspace explorer collapsed but easy to open", () => {
    localStorage.removeItem("loom:right-panel-open:v1");
    localStorage.removeItem("loom:conversations:v1");
    render(<App />);

    const tools = screen.getByRole("complementary", { name: "Workspace tools" });
    expect(screen.queryByRole("complementary", { name: "Workspace explorer" })).toBeNull();
    expect(within(tools).getByRole("button", { name: "Show workspace explorer" })).toBeTruthy();
    expect(within(tools).getByRole("button", { name: "Open workspace" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^New chat$/ })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Repository context" }).textContent).toContain(
      "No workspace open",
    );
  });

  test("offers workspace selection from the no-workspace chat welcome state", () => {
    render(<App />);

    const welcome = screen.getByRole("region", { name: "Welcome" });
    expect(welcome.textContent).toContain("Start chatting without a workspace");
    const openWorkspace = within(welcome).getByRole("button", { name: "Open workspace" });
    expect(openWorkspace.querySelector('[data-icon="folder"]')).toBeTruthy();
    expect(openWorkspace.closest("p")).toBeNull();
    expect(openWorkspace.classList.contains("welcome-workspace-action")).toBe(true);
    expect(
      within(welcome)
        .getByRole("button", { name: "Create workspace" })
        .classList.contains("welcome-workspace-action"),
    ).toBe(true);
    expect(
      within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
        "button",
        { name: "Open workspace" },
      ),
    ).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Message Loom" })).toBeTruthy();
  });

  test("validates a new workspace name before asking for its parent folder", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));
    expect(screen.getByRole("dialog", { name: "Create a workspace" })).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Workspace name" }), {
      target: { value: "bad/name" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Choose location" }));

    expect(screen.getByRole("alert").textContent).toBe(
      "Enter a workspace name without reserved characters.",
    );
  });

  test("creates and selects the named workspace returned by the desktop workspace API", async () => {
    const previousApi = window.loomDesktop;
    const createWorkspace = mock(async (name: string) => ({ root: `C:/workspaces/${name}` }));
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => null,
        create: createWorkspace,
        list: async () => [],
        gitStatus: async () => ({ isGit: false, branch: "" }),
        readFile: async () => ({ content: "" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));
      fireEvent.change(screen.getByRole("textbox", { name: "Workspace name" }), {
        target: { value: "fresh-workspace" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Choose location" }));

      await waitFor(() => expect(createWorkspace).toHaveBeenCalledWith("fresh-workspace"));
      await waitFor(() =>
        expect(screen.getByRole("group", { name: "Repository context" }).textContent).toContain(
          "fresh-workspace",
        ),
      );
      expect(screen.getByRole("group", { name: "Repository context" }).textContent).toContain(
        "No Git",
      );
    } finally {
      window.loomDesktop = previousApi;
    }
  });

  test("keeps workspace and Git status in a footer below the composer", () => {
    render(<App />);

    const main = screen.getByRole("main", { name: "Conversation" });
    const composer = within(main).getByRole("textbox", { name: "Message Loom" });
    const composerSurface = composer.closest(".composer-wrap");
    const context = within(main).getByRole("group", { name: "Repository context" });

    expect(composerSurface).toBeTruthy();
    expect(context.compareDocumentPosition(composerSurface!)).toBe(
      Node.DOCUMENT_POSITION_PRECEDING,
    );
    expect(context.textContent).toContain("No workspace open");
    expect(context.textContent).toContain("No Git");
  });

  test("centers the welcome heading and composer in a dedicated empty-chat layout", () => {
    render(<App />);

    const welcome = screen.getByRole("region", { name: "Welcome" });
    expect(welcome.parentElement?.classList.contains("chat-panel-empty")).toBe(true);
    expect(welcome.querySelector(".welcome-mark img")).toBeTruthy();
    expect(welcome.querySelector(".welcome-title")).toBeTruthy();
    const composerDock = welcome.nextElementSibling;
    expect(composerDock?.classList.contains("chat-composer-dock")).toBe(true);
    expect(composerDock?.querySelector(".composer-wrap-empty")).toBeTruthy();
    expect(composerDock?.querySelector(".repository-context")).toBeTruthy();
  });

  test("keeps Git status in a separate row beneath the chat composer", () => {
    render(<App />);

    const composerDock = screen.getByRole("region", { name: "Welcome" }).nextElementSibling;
    const composer = composerDock?.querySelector(".composer-wrap");
    const repositoryContext = composerDock?.querySelector(".repository-context");

    expect(composerDock?.classList.contains("chat-composer-dock")).toBe(true);
    expect(repositoryContext?.parentElement).toBe(composerDock);
    expect(composer?.parentElement).toBe(composerDock);
    expect(
      (composer!.compareDocumentPosition(repositoryContext!) & Node.DOCUMENT_POSITION_FOLLOWING) >
        0,
    ).toBe(true);
    expect(repositoryContext?.querySelector(".repository-context-workspace")).toBeTruthy();
    expect(repositoryContext?.querySelector(".repository-context-git")?.textContent).toContain(
      "No Git",
    );
  });

  test("gives the empty-chat brand mark room without stacking extra margin on the welcome gap", () => {
    render(<App />);

    const brandMark = screen
      .getByRole("region", { name: "Welcome" })
      .querySelector(".welcome-mark");
    expect(brandMark).toBeTruthy();
    expect(brandMark?.classList.contains("welcome-mark-empty")).toBe(true);
  });

  test("keeps workspace and repository context below the composer", () => {
    render(<App />);

    const header = screen.getByRole("banner", { name: "Session context" });
    expect(header.textContent).toContain("New chat");
    expect(header.textContent).not.toContain("No workspace open");
    expect(within(header).getByRole("button", { name: "Open settings" })).toBeTruthy();

    const repositoryContext = screen.getByRole("group", { name: "Repository context" });
    expect(repositoryContext.textContent).toContain("No workspace open");
    expect(repositoryContext.textContent).toContain("No Git");
  });

  test("keeps workspace and Git context in the persistent footer during an active chat", () => {
    render(<App />);
    fireEvent.change(screen.getByRole("textbox", { name: "Message Loom" }), {
      target: { value: "Start an active conversation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    const chat = screen.getByRole("tabpanel", { name: "Chat" });
    const composer = chat.querySelector(".composer-wrap");
    const dock = chat.querySelector(".chat-composer-dock");
    const timeline = chat.querySelector(".message-list");
    const context = within(chat).getByRole("group", { name: "Repository context" });
    expect(composer).toBeTruthy();
    expect(dock).toBeTruthy();
    expect(dock?.classList.contains("chat-composer-dock-active")).toBe(true);
    expect((timeline!.compareDocumentPosition(dock!) & Node.DOCUMENT_POSITION_FOLLOWING) > 0).toBe(
      true,
    );
    expect(
      (dock!.compareDocumentPosition(composer!) & Node.DOCUMENT_POSITION_CONTAINED_BY) > 0,
    ).toBe(true);
    expect(composer!.compareDocumentPosition(context)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  test("shows provider setup status in chat when no provider is configured", () => {
    render(<App />);

    expect(screen.getByRole("banner", { name: "Session context" }).textContent).toContain(
      "Provider not configured",
    );
  });

  test("uses a compact session header at narrow viewport widths", () => {
    render(<App />);

    const header = screen.getByRole("banner", { name: "Session context" });
    expect(header.classList.contains("session-context")).toBe(true);
    expect(header.querySelector(".session-context-title")).toBeTruthy();
    expect(header.querySelector(".session-context-actions")).toBeTruthy();
  });

  test("keeps only New chat and the active session in the narrow titlebar", () => {
    const stylesheet = readFileSync(fileURLToPath(new URL("./App.css", import.meta.url)), "utf8");
    const compactSessionTabs = stylesheet.match(
      /@media \(max-width: 640px\) \{([\s\S]*)$/,
    )?.[1];

    expect(compactSessionTabs).toMatch(
      /\.session-tab:not\(\.active\):not\(\[aria-label="New chat"\]\)\s*\{\s*display:\s*none;/,
    );
    expect(compactSessionTabs).toMatch(/\.session-tab-add\s*\{\s*display:\s*none;/);
  });

  test("shows the three main desktop regions", () => {
    render(<App />);

    expect(screen.getByRole("navigation", { name: "Conversations" })).toBeTruthy();

    expect(screen.getByRole("main", { name: "Conversation" })).toBeTruthy();

    expect(screen.getByRole("complementary", { name: "Workspace explorer" }).textContent).toContain(
      "No workspace open",
    );
    expect(
      within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
        "button",
        { name: "Open workspace" },
      ),
    ).toBeTruthy();
  });

  test("uses the operating system menu in desktop mode instead of rendering a duplicate bar", () => {
    const previousApi = window.loomDesktop;
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      onMenuAction: () => () => undefined,
      setAutoSaveState: () => undefined,
      workspace: {
        open: async () => null,
        list: async () => [],
        gitStatus: async () => ({ isGit: false, branch: "" }),
        readFile: async () => ({ content: "" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      expect(screen.queryByRole("navigation", { name: "Application menu" })).toBeNull();
    } finally {
      window.loomDesktop = previousApi;
    }
  });

  test("shows repository status below the composer and reports when Git is unavailable", () => {
    render(<App />);

    const context = screen.getByRole("group", { name: "Repository context" });
    expect(context.textContent).toContain("No workspace open");
    expect(context.textContent).toContain("No Git");
    expect(context.querySelector(".repository-context-separator")).toBeNull();
    expect(context.querySelector(".repository-context-git svg")?.getAttribute("data-icon")).toBe(
      "monitor",
    );
    expect(context.querySelector(".repository-context-git")?.getAttribute("aria-live")).toBe(
      "polite",
    );
    expect(context.querySelector(".repository-context-git")?.getAttribute("aria-label")).toBe(
      "No Git",
    );
    expect(document.querySelector(".session-context")?.textContent).not.toContain("No Git");
  });

  test("shows No Git below the composer for an opened non-repository workspace", async () => {
    const previousApi = window.loomDesktop;
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/Users/Admin/Downloads" }),
        list: async () => [],
        gitStatus: async () => ({ isGit: false, branch: "" }),
        readFile: async () => ({ content: "" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "test" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };

    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );

      const context = await screen.findByRole("group", { name: "Repository context" });
      await waitFor(() => expect(context.textContent).toContain("Downloads"));
      expect(context.textContent).toContain("No Git");
      expect(context.querySelector(".repository-context-git svg")?.getAttribute("data-icon")).toBe(
        "monitor",
      );
    } finally {
      window.loomDesktop = previousApi;
    }
  });

  test("opens or switches workspaces from the context row below the composer", async () => {
    const previousApi = window.loomDesktop;
    const openWorkspace = mock(async () => ({ root: "C:/next-workspace" }));
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: openWorkspace,
        list: async () => [],
        gitStatus: async () => ({ isGit: false, branch: "" }),
        readFile: async () => ({ content: "" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "test" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };

    try {
      render(<App />);
      const context = screen.getByRole("group", { name: "Repository context" });
      fireEvent.click(within(context).getByRole("button", { name: "Select workspace" }));

      await waitFor(() => expect(openWorkspace).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(context.textContent).toContain("next-workspace"));
      expect(screen.getByRole("banner", { name: "Session context" }).textContent).not.toContain(
        "next-workspace",
      );
    } finally {
      window.loomDesktop = previousApi;
    }
  });

  test("allows repository context chips to wrap on narrow chat layouts", () => {
    render(<App />);

    const context = screen.getByRole("group", { name: "Repository context" });
    expect(context.className).toContain("flex-wrap");
    expect(context.className).toContain("px-3");
  });

  test("shows the active Git branch below the composer when the workspace is a repository", async () => {
    const previousApi = window.loomDesktop;
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/repo" }),
        list: async () => [],
        gitStatus: async () => ({ isGit: true, branch: "feature/chat-ui" }),
        readFile: async () => ({ content: "" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "test" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: true }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      const context = await screen.findByRole("group", { name: "Repository context" });
      await waitFor(() => expect(context.textContent).toContain("feature/chat-ui"));
      expect(context.querySelector(".repository-context-git")?.getAttribute("aria-live")).toBe(
        "polite",
      );
      expect(context.querySelector(".repository-context-git")?.getAttribute("aria-label")).toBe(
        "Current branch: feature/chat-ui",
      );
      expect(context.querySelector(".repository-context-separator")).toBeTruthy();
      expect(context.querySelector(".repository-context-git svg")?.getAttribute("data-icon")).toBe(
        "branch",
      );
      expect(context.textContent).not.toContain("No Git");
      expect(screen.getByRole("banner", { name: "Session context" }).textContent).not.toContain(
        "feature/chat-ui",
      );
    } finally {
      window.loomDesktop = previousApi;
    }
  });

  test("does not label an unavailable Git branch as detached HEAD", async () => {
    const previousApi = window.loomDesktop;
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/linked-worktree" }),
        list: async () => [],
        gitStatus: async () => ({ isGit: true, branch: "" }),
        readFile: async () => ({ content: "" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: true }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      const context = await screen.findByRole("group", { name: "Repository context" });
      await waitFor(() => expect(context.textContent).toContain("Branch unavailable"));
      expect(context.textContent).not.toContain("Detached HEAD");
    } finally {
      window.loomDesktop = previousApi;
    }
  });

  test("searches nested workspace files and opens a match without expanding the tree", async () => {
    const priorApi = window.loomDesktop;
    const list = mock(async (path: string) => {
      if (path === ".") {
        return [{ name: "src", path: "src", isDir: true, size: 0 }];
      }
      if (path === "src") {
        return [{ name: "components", path: "src/components", isDir: true, size: 0 }];
      }
      if (path === "src/components") {
        return [
          { name: "Button.tsx", path: "src/components/Button.tsx", isDir: false, size: 32 },
          { name: "Dialog.tsx", path: "src/components/Dialog.tsx", isDir: false, size: 48 },
        ];
      }
      return [];
    });
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list,
        readFile: async (path) => ({ content: `// ${path}` }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "test" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: true }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      await waitFor(() => expect(screen.getByText("src")).toBeTruthy());
      fireEvent.change(screen.getByRole("textbox", { name: "Search workspace files" }), {
        target: { value: "button" },
      });

      const match = await screen.findByRole("button", {
        name: "Open src/components/Button.tsx",
      });
      expect(screen.queryByRole("button", { name: "Open src/components/Dialog.tsx" })).toBeNull();
      expect(list).toHaveBeenCalledWith("src/components");
      fireEvent.click(match);

      expect(await screen.findByRole("tab", { name: "Button.tsx" })).toBeTruthy();
      expect(screen.getByRole("tabpanel", { name: "src/components/Button.tsx" })).toBeTruthy();
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("reuses one in-flight workspace scan while the search query changes", async () => {
    const priorApi = window.loomDesktop;
    let rootCalls = 0;
    let resolveSearchRoot!: (
      entries: { name: string; path: string; isDir: boolean; size: number }[],
    ) => void;
    const delayedRoot = new Promise<{ name: string; path: string; isDir: boolean; size: number }[]>(
      (resolve) => {
        resolveSearchRoot = resolve;
      },
    );
    const list = mock(async (path: string) => {
      if (path === ".") {
        rootCalls += 1;
        return rootCalls === 1 ? [{ name: "src", path: "src", isDir: true, size: 0 }] : delayedRoot;
      }
      return [{ name: "Button.tsx", path: "src/Button.tsx", isDir: false, size: 32 }];
    });
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list,
        readFile: async () => ({ content: "export const Button = () => null;" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "test" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: true }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      await screen.findByText("src");
      const search = screen.getByRole("textbox", { name: "Search workspace files" });
      fireEvent.change(search, { target: { value: "b" } });
      fireEvent.change(search, { target: { value: "bu" } });
      fireEvent.change(search, { target: { value: "but" } });
      await waitFor(() => expect(rootCalls).toBe(2));
      expect(list).toHaveBeenCalledTimes(2);

      await act(async () => {
        resolveSearchRoot([{ name: "src", path: "src", isDir: true, size: 0 }]);
      });

      expect(await screen.findByRole("button", { name: "Open src/Button.tsx" })).toBeTruthy();
      expect(list).toHaveBeenCalledTimes(3);
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("resizes the conversation sidebar with keyboard controls", () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      private readonly callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe(target: Element) {
        this.callback(
          [{ target, contentRect: { width: 1280 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }

      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver;
    const view = render(<App />);
    try {
      const splitter = screen.getByRole("separator", { name: "Resize conversation sidebar" });
      const initialWidth = Number(splitter.getAttribute("aria-valuenow"));

      fireEvent.keyDown(splitter, { key: "ArrowRight" });

      expect(Number(splitter.getAttribute("aria-valuenow"))).toBe(initialWidth + 12);
    } finally {
      view.unmount();
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  test("restores the conversation sidebar to a usable width after keyboard collapse", () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      private readonly callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe(target: Element) {
        this.callback(
          [{ target, contentRect: { width: 1280 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }

      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver;
    const view = render(<App />);
    try {
      const splitter = screen.getByRole("separator", { name: "Resize conversation sidebar" });
      for (let index = 0; index < 20; index += 1) {
        fireEvent.keyDown(splitter, { key: "ArrowLeft" });
      }

      expect(screen.getByRole("button", { name: "Show conversations" })).toBeTruthy();
      fireEvent.keyDown(screen.getByRole("separator", { name: "Resize conversation sidebar" }), {
        key: "ArrowRight",
      });
      expect(screen.getByRole("navigation", { name: "Conversations" })).toBeTruthy();
      expect(
        Number(
          screen
            .getByRole("separator", { name: "Resize conversation sidebar" })
            .getAttribute("aria-valuenow"),
        ),
      ).toBeGreaterThanOrEqual(190);

      fireEvent.click(screen.getByRole("button", { name: "Hide conversations" }));
      fireEvent.click(screen.getByRole("button", { name: "Show conversations" }));

      expect(
        Number(
          screen
            .getByRole("separator", { name: "Resize conversation sidebar" })
            .getAttribute("aria-valuenow"),
        ),
      ).toBeGreaterThanOrEqual(190);
      expect(screen.getByRole("navigation", { name: "Conversations" })).toBeTruthy();
    } finally {
      view.unmount();
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  test("restores the workspace explorer to a usable width after keyboard collapse", () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      private readonly callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe(target: Element) {
        this.callback(
          [{ target, contentRect: { width: 1280 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }

      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver;
    const view = render(<App />);
    try {
      const splitter = screen.getByRole("separator", { name: "Resize workspace explorer" });
      for (let index = 0; index < 20; index += 1) {
        fireEvent.keyDown(splitter, { key: "ArrowRight" });
      }

      expect(screen.getByRole("button", { name: "Show workspace explorer" })).toBeTruthy();
      fireEvent.keyDown(screen.getByRole("separator", { name: "Resize workspace explorer" }), {
        key: "ArrowLeft",
      });
      expect(screen.getByRole("complementary", { name: "Workspace explorer" })).toBeTruthy();
      expect(
        Number(
          screen
            .getByRole("separator", { name: "Resize workspace explorer" })
            .getAttribute("aria-valuenow"),
        ),
      ).toBeGreaterThanOrEqual(210);

      fireEvent.click(screen.getByRole("button", { name: "Hide workspace explorer" }));
      fireEvent.click(screen.getByRole("button", { name: "Show workspace explorer" }));
      expect(
        Number(
          screen
            .getByRole("separator", { name: "Resize workspace explorer" })
            .getAttribute("aria-valuenow"),
        ),
      ).toBeGreaterThanOrEqual(210);
    } finally {
      view.unmount();
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  test("dragging the conversation divider to the collapse point closes the sidebar", () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      private readonly callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe(target: Element) {
        this.callback(
          [{ target, contentRect: { width: 1280 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }

      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver;
    const view = render(<App />);
    try {
      const divider = screen.getByRole("separator", { name: "Resize conversation sidebar" });
      fireEvent.pointerDown(divider, { pointerId: 1, clientX: 248 });
      fireEvent.pointerMove(divider, { pointerId: 1, clientX: 60 });
      fireEvent.pointerUp(divider, { pointerId: 1, clientX: 60 });

      expect(screen.getByRole("complementary", { name: "Conversation tools" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Show conversations" })).toBeTruthy();
    } finally {
      view.unmount();
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  test("dragging the workspace divider to the collapse point closes the explorer", () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      private readonly callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe(target: Element) {
        this.callback(
          [{ target, contentRect: { width: 1280 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }

      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver;
    const view = render(<App />);
    try {
      const divider = screen.getByRole("separator", { name: "Resize workspace explorer" });
      fireEvent.pointerDown(divider, { pointerId: 1, clientX: 1000 });
      fireEvent.pointerMove(divider, { pointerId: 1, clientX: 1232 });
      fireEvent.pointerUp(divider, { pointerId: 1, clientX: 1232 });

      expect(screen.getByRole("complementary", { name: "Workspace tools" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Show workspace explorer" })).toBeTruthy();
    } finally {
      view.unmount();
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  test("opens either side panel from its rail in a compact viewport", () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      private readonly callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe(target: Element) {
        this.callback(
          [{ target, contentRect: { width: 760 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }

      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver;
    const view = render(<App />);
    try {
      fireEvent.click(screen.getByRole("button", { name: "Show conversations" }));
      expect(screen.getByRole("navigation", { name: "Conversations" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Hide conversations" })).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Show file explorer" }));
      expect(screen.getByRole("complementary", { name: "Workspace explorer" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Hide workspace explorer" })).toBeTruthy();
      expect(screen.queryByRole("navigation", { name: "Conversations" })).toBeNull();
      expect(screen.getByRole("main", { name: "Conversation" })).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Hide workspace explorer" }));
      expect(screen.getByRole("complementary", { name: "Workspace tools" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Show conversations" }));
      expect(screen.getByRole("navigation", { name: "Conversations" })).toBeTruthy();
    } finally {
      view.unmount();
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  test("Escape dismisses a delete dialog without deleting the conversation", () => {
    render(<App />);
    fireEvent.change(screen.getByRole("textbox", { name: "Message Loom" }), {
      target: { value: "Keep this conversation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete chat Keep this conversation" }));
    const dialog = screen.getByRole("dialog", { name: "Delete conversation?" });
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    const confirm = within(dialog).getByRole("button", { name: "Delete chat" });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirm);

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Delete conversation?" })).toBeNull();
    expect(screen.getByRole("navigation", { name: "Conversations" }).textContent).toContain(
      "Keep this conversation",
    );
  });

  test("places File Edit View and Help menus above all three workbench columns", () => {
    render(<App />);
    const menuBar = screen.getByRole("navigation", { name: "Application menu" });
    for (const name of ["File", "Edit", "View", "Help"]) {
      expect(menuBar.querySelector(`button[aria-label="${name}"]`)).toBeTruthy();
    }
    expect(document.querySelector(".app-splitter")).toBeTruthy();
  });

  test("keeps workspace identity below the composer instead of repeating it in the app bar", () => {
    render(<App />);

    const menuBar = screen.getByRole("navigation", { name: "Application menu" });
    const repositoryContext = screen.getByRole("group", { name: "Repository context" });

    expect(menuBar.textContent).not.toContain("No workspace open");
    expect(menuBar.textContent).not.toContain("Desktop workspace");
    expect(repositoryContext.textContent).toContain("No workspace open");
  });

  test("adds a sent prompt to the conversation", () => {
    render(<App />);

    const composer = screen.getByRole("textbox", { name: "Message Loom" });
    fireEvent.change(composer, { target: { value: "Review this codebase" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(screen.getByRole("log").textContent).toContain("Review this codebase");
    expect(screen.getByRole("navigation", { name: "Conversations" }).textContent).toContain(
      "Review this codebase",
    );
    expect(composer.getAttribute("rows")).toBe("2");
    expect(screen.getByText("Enter to send · Shift+Enter for a new line")).toBeTruthy();
    expect((composer as HTMLTextAreaElement).value).toBe("");
  });

  test("follows new messages until the reader scrolls up, then offers Jump to latest", () => {
    localStorage.setItem(
      "loom:conversations:v1",
      JSON.stringify({
        conversations: [
          {
            id: "conversation-scroll",
            title: "Scroll behavior",
            messages: [
              { role: "user", content: "Earlier question" },
              { role: "assistant", content: "Earlier answer" },
            ],
          },
          {
            id: "conversation-other",
            title: "Other conversation",
            messages: [
              { role: "user", content: "Other question" },
              { role: "assistant", content: "Other answer" },
            ],
          },
        ],
        activeConversationId: "conversation-scroll",
      }),
    );
    render(<App />);

    const messageList = screen.getByRole("log");
    Object.defineProperties(messageList, {
      scrollHeight: { configurable: true, value: 900 },
      clientHeight: { configurable: true, value: 300 },
    });
    const composer = screen.getByRole("textbox", { name: "Message Loom" });
    fireEvent.change(composer, { target: { value: "Follow latest" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(messageList.scrollTop).toBe(900);
    expect(screen.queryByRole("button", { name: "Jump to latest" })).toBeNull();

    messageList.scrollTop = 0;
    fireEvent.scroll(messageList);
    expect(screen.getByRole("button", { name: "Jump to latest" })).toBeTruthy();

    fireEvent.change(composer, { target: { value: "Keep reading above" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(messageList.scrollTop).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Jump to latest" }));
    expect(messageList.scrollTop).toBe(900);
    expect(screen.queryByRole("button", { name: "Jump to latest" })).toBeNull();

    messageList.scrollTop = 0;
    fireEvent.scroll(messageList);
    fireEvent.click(screen.getByRole("tab", { name: "Other conversation" }));
    expect(screen.getByRole("log").textContent).toContain("Other answer");
    expect(messageList.scrollTop).toBe(900);
    expect(screen.queryByRole("button", { name: "Jump to latest" })).toBeNull();
  });

  test("keeps New chat visible and does not list an unstarted chat until its first message", async () => {
    localStorage.setItem("loom:left-panel-open:v1", "true");
    localStorage.removeItem("loom:conversations:v1");
    render(<App />);
    expect(screen.getByRole("button", { name: /^New chat$/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^New chat$/ }));
    expect(
      screen
        .getByRole("navigation", { name: "Conversations" })
        .querySelectorAll(".conversation-list-item"),
    ).toHaveLength(0);
    expect(screen.getByRole("banner", { name: "Session context" }).textContent).toContain(
      "New chat",
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Message Loom" }), {
      target: { value: "Keep this conversation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(screen.getByRole("navigation", { name: "Conversations" }).textContent).toContain(
      "Keep this conversation",
    );
    fireEvent.click(screen.getByRole("tab", { name: "New chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete chat Keep this conversation" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Delete chat$/ }));

    expect(screen.queryByRole("button", { name: /Keep this conversation/ })).toBeNull();
  });

  test("keeps the delete control inside its conversation row", () => {
    localStorage.setItem(
      "loom:conversations:v1",
      JSON.stringify({
        conversations: [
          {
            id: "row-test",
            title: "A saved chat",
            messages: [{ role: "user", content: "A saved message" }],
          },
        ],
        activeConversationId: "row-test",
      }),
    );
    render(<App />);
    const row = screen.getByRole("button", { name: "Delete chat A saved chat" }).parentElement;
    expect(row?.classList.contains("conversation-list-item")).toBe(true);
    expect(row?.classList.contains("active")).toBe(true);
    expect(row?.querySelector(".conversation-item")?.classList.contains("active")).toBe(false);
    expect(row?.querySelector(".conversation-delete-button")).toBeTruthy();
    expect(row?.classList.contains("flex")).toBe(true);
    expect(row?.querySelector(".conversation-row-content")?.classList.contains("flex-1")).toBe(
      true,
    );
    expect(row?.querySelector(".conversation-delete-button")?.classList.contains("!absolute")).toBe(
      false,
    );
    expect(row?.classList.contains("flex")).toBe(true);
    expect(row?.querySelector(".conversation-row-content")?.classList.contains("flex-1")).toBe(
      true,
    );
    expect(row?.querySelector(".conversation-delete-button")?.classList.contains("!absolute")).toBe(
      false,
    );
  });

  test("keeps conversation row hover styling on the parent, not the title button", () => {
    localStorage.setItem(
      "loom:conversations:v1",
      JSON.stringify({
        conversations: [
          {
            id: "hover-test",
            title: "A saved chat",
            messages: [{ role: "user", content: "A saved message" }],
          },
        ],
        activeConversationId: "hover-test",
      }),
    );
    render(<App />);
    const row = screen.getByRole("button", { name: /Delete chat A saved chat/ }).parentElement;
    const titleButton = row?.querySelector(".conversation-item");
    expect(row?.className).toContain("active");
    expect(titleButton?.className).not.toContain("hover:bg-");
    fireEvent.mouseEnter(row!);
    expect(row?.className).toContain("active bg-[var(--loom-panel-raised)]");
    const deleteButtonClass = row?.querySelector(".conversation-delete-button")?.className ?? "";
    const deleteButtonClasses = deleteButtonClass.split(/\s+/);
    expect(deleteButtonClasses.includes("opacity-100")).toBe(true);
    expect(deleteButtonClasses.includes("pointer-events-auto")).toBe(true);
    expect(titleButton?.className).not.toContain("bg-[var(--loom-panel-raised)]");
  });

  test("reveals delete actions when keyboard focus enters active and inactive chat rows", () => {
    localStorage.setItem(
      "loom:conversations:v1",
      JSON.stringify({
        conversations: [
          {
            id: "active-chat",
            title: "Active chat",
            messages: [{ role: "user", content: "Active message" }],
          },
          {
            id: "inactive-chat",
            title: "Inactive chat",
            messages: [{ role: "user", content: "Inactive message" }],
          },
        ],
        activeConversationId: "active-chat",
      }),
    );
    render(<App />);
    const rows = [...document.querySelectorAll<HTMLElement>(".conversation-list-item")];

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const title = row.querySelector<HTMLButtonElement>(".conversation-item");
      const deleteButton = row.querySelector<HTMLButtonElement>(".conversation-delete-button");
      expect(title).toBeTruthy();
      expect(deleteButton?.className).toContain("pointer-events-none");

      fireEvent.focus(title!);
      expect(deleteButton?.className).toContain("opacity-100");
      expect(deleteButton?.getAttribute("aria-label")).toMatch(/^Delete chat /);

      fireEvent.blur(title!, { relatedTarget: null });
      expect(deleteButton?.className).toContain("pointer-events-none");
    }
  });

  test("keeps New chat available when no conversations exist", () => {
    render(
      <ConversationSidebar
        conversations={[]}
        activeConversationId=""
        searchQuery=""
        onSearchChange={() => undefined}
        onSelectConversation={() => undefined}
        onNewConversation={() => undefined}
        canCreateConversation
        onDeleteConversation={() => undefined}
        onOpenSettings={() => undefined}
        onCollapse={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: /^New chat$/ })).toBeTruthy();
    expect(screen.queryByText("RECENT")).toBeNull();
    expect(screen.getByRole("button", { name: /Settings/ })).toBeTruthy();
  });

  test("keeps New chat available from the collapsed rail when no conversations exist", () => {
    render(
      <ConversationSidebar
        conversations={[]}
        activeConversationId=""
        searchQuery=""
        onSearchChange={() => undefined}
        onSelectConversation={() => undefined}
        onNewConversation={() => undefined}
        canCreateConversation
        onDeleteConversation={() => undefined}
        onOpenSettings={() => undefined}
        onCollapse={() => undefined}
        collapsed
      />,
    );

    expect(screen.getByRole("button", { name: "New chat" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show conversations" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open settings" })).toBeTruthy();
  });

  test("keeps New chat available in the collapsed rail when a conversation exists", () => {
    render(
      <ConversationSidebar
        conversations={[
          {
            id: "saved-chat",
            title: "Saved chat",
            messages: [{ role: "user", content: "Hello" }],
          },
        ]}
        activeConversationId="saved-chat"
        searchQuery=""
        onSearchChange={() => undefined}
        onSelectConversation={() => undefined}
        onNewConversation={() => undefined}
        canCreateConversation
        onDeleteConversation={() => undefined}
        onOpenSettings={() => undefined}
        onCollapse={() => undefined}
        collapsed
      />,
    );

    expect(screen.getByRole("button", { name: "New chat" })).toBeTruthy();
  });

  test("shows New chat without adding an unstarted draft to the conversation list", () => {
    localStorage.removeItem("loom:conversations:v1");

    render(<App />);

    expect(screen.getByRole("button", { name: /^New chat$/ })).toBeTruthy();
    const sessionTabs = screen.getByRole("tablist", { name: "Session tabs" });
    expect(
      within(sessionTabs).getByRole("tab", { name: "New chat" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      within(sessionTabs.parentElement!).getByRole("button", { name: "Create chat" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("navigation", { name: "Conversations" })
        .querySelector(".conversation-list-item"),
    ).toBeNull();
  });

  test("creating chat from the titlebar clears the active session and exposes a New chat tab", () => {
    localStorage.setItem(
      "loom:conversations:v1",
      JSON.stringify({
        conversations: [
          {
            id: "saved-session",
            title: "Saved session",
            messages: [{ role: "user", content: "Saved message" }],
          },
        ],
        activeConversationId: "saved-session",
      }),
    );

    render(<App />);
    const sessionTabs = screen.getByRole("tablist", { name: "Session tabs" });
    fireEvent.click(
      within(sessionTabs.parentElement!).getByRole("button", { name: "Create chat" }),
    );

    expect(within(sessionTabs).getByRole("tab", { name: "New chat" })).toBeTruthy();
    expect(
      within(sessionTabs).getByRole("tab", { name: "New chat" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByRole("banner", { name: "Session context" }).textContent).toContain(
      "New chat",
    );
    expect(screen.getByRole("heading", { name: "What are we building today?" })).toBeTruthy();
    expect(screen.queryByRole("log")).toBeNull();
  });

  test("leaves the conversation list empty after deleting the last session", async () => {
    localStorage.setItem(
      "loom:conversations:v1",
      JSON.stringify({
        conversations: [
          {
            id: "only-chat",
            title: "Only chat",
            messages: [{ role: "user", content: "A saved session" }],
          },
        ],
        activeConversationId: "only-chat",
      }),
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Delete chat Only chat" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Delete chat$/ }));

    expect(
      screen
        .getByRole("navigation", { name: "Conversations" })
        .querySelector(".conversation-list-item"),
    ).toBeNull();
    expect(screen.getByRole("button", { name: /^New chat$/ })).toBeTruthy();
  });

  test("restores conversations and messages after the app is mounted again", () => {
    localStorage.removeItem("loom:conversations:v1");
    const firstMount = render(<App />);
    fireEvent.change(screen.getByRole("textbox", { name: "Message Loom" }), {
      target: { value: "Persist this session" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    firstMount.unmount();

    render(<App />);

    expect(screen.getByRole("log").textContent).toContain("Persist this session");
  });

  test("configures an OpenAI-compatible provider and streams assistant output", async () => {
    const priorApi = window.loomDesktop;
    const configure = mock(async () => ({ configured: true, model: "gpt-4o-mini" }));
    const stream = mock(
      async (
        _runId: string,
        _request: unknown,
        onUpdate: (event: { content?: string }) => void,
      ) => {
        onUpdate({ content: "Connected " });
        onUpdate({ content: "response" });
      },
    );
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list: async () => [],
        readFile: async () => ({ content: "" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure,
        stream,
        cancel: async () => ({ cancelled: true }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
      fireEvent.click(screen.getByRole("tab", { name: "Gateway" }));
      fireEvent.change(screen.getByLabelText("Base URL"), {
        target: { value: "http://localhost:1234/v1" },
      });
      fireEvent.change(screen.getByLabelText("Gateway model"), {
        target: { value: "gpt-4o-mini" },
      });
      fireEvent.change(screen.getByLabelText("API key"), { target: { value: "secret" } });
      fireEvent.click(screen.getByRole("button", { name: "Connect provider" }));
      await act(async () => {
        await waitFor(() => expect(configure).toHaveBeenCalled());
      });
      fireEvent.change(screen.getByRole("textbox", { name: "Message Loom" }), {
        target: { value: "Hello" },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Send message" }));
      });
      await waitFor(() =>
        expect(screen.getByRole("log").textContent).toContain("Connected response"),
      );
      expect(stream).toHaveBeenCalled();
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("shows a failed run in the active session context", async () => {
    const priorApi = window.loomDesktop;
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => null,
        list: async () => [],
        gitStatus: async () => ({ isGit: false, branch: "" }),
        readFile: async () => ({ content: "" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "http://local/v1", model: "test", configured: true }),
        configure: async () => ({ configured: true, model: "test" }),
        stream: async () => {
          throw new Error("The gateway is unavailable.");
        },
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      await waitFor(() =>
        expect(
          screen.getByRole("complementary", { name: "Workspace explorer" }).textContent,
        ).toContain("Provider connected"),
      );
      fireEvent.change(screen.getByRole("textbox", { name: "Message Loom" }), {
        target: { value: "Try a request" },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Send message" }));
      });

      await waitFor(() =>
        expect(screen.getByRole("banner", { name: "Session context" }).textContent).toContain(
          "Run failed",
        ),
      );
      expect(screen.getByRole("log").textContent).toContain("The gateway is unavailable.");
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("stops an active run and preserves the partial assistant response", async () => {
    const priorApi = window.loomDesktop;
    let finishStream: (() => void) | undefined;
    let publishLateUpdate: ((event: { content?: string; done?: boolean }) => void) | undefined;
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => null,
        list: async () => [],
        readFile: async () => ({ content: "" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "http://local/v1", model: "test", configured: true }),
        configure: async () => ({ configured: true, model: "test" }),
        stream: mock(
          async (
            _runId: string,
            _request: unknown,
            onUpdate: (event: { content?: string; done?: boolean }) => void,
          ) => {
            onUpdate({ content: "Partial answer" });
            publishLateUpdate = onUpdate;
            await new Promise<void>((resolve) => {
              finishStream = resolve;
            });
          },
        ),
        cancel: async () => ({ cancelled: true }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      await waitFor(() =>
        expect(
          screen.getByRole("complementary", { name: "Workspace explorer" }).textContent,
        ).toContain("Provider connected"),
      );
      fireEvent.change(screen.getByRole("textbox", { name: "Message Loom" }), {
        target: { value: "Try this" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Send message" }));
      await waitFor(() => expect(screen.getByRole("log").textContent).toContain("Partial answer"));
      expect(screen.getByRole("status").textContent).toBe("Responding…");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Stop run" }));
      });
      await waitFor(() => expect(screen.getByRole("log").textContent).toContain("Partial answer"));
      expect(screen.queryByRole("button", { name: "Stop run" })).toBeNull();
      expect(screen.getByRole("log").textContent).toContain("Partial answer");
      expect(screen.getByRole("log").textContent).toContain("Cancelled");
      expect(screen.getByRole("banner", { name: "Session context" }).textContent).toContain(
        "Cancelled",
      );
      await act(async () => {
        publishLateUpdate?.({ content: " late output" });
        publishLateUpdate?.({ done: true });
        finishStream?.();
        await Promise.resolve();
      });
      await waitFor(() => expect(screen.getByRole("log").textContent).toContain("Cancelled"));
      expect(screen.getByRole("log").textContent).not.toContain("late output");
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("shows a real tool approval and sends the user's decision back to the runtime", async () => {
    const priorApi = window.loomDesktop;
    const respondApproval = mock(async () => ({ accepted: true }));
    let streamCount = 0;
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => null,
        list: async () => [],
        readFile: async () => ({ content: "" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "http://local/v1", model: "test", configured: true }),
        configure: async () => ({ configured: true, model: "test" }),
        stream: async (_runId, _request, onUpdate) => {
          if (streamCount++ === 0) {
            onUpdate({
              approval: {
                id: "call-1",
                toolName: "workspace.writeFile",
                arguments: { path: "src/main.go", content: "safe" },
              },
            });
            return;
          }
          onUpdate({ content: "Follow-up response" });
        },
        cancel: async () => ({ cancelled: false }),
        respondApproval,
      },
    };
    try {
      render(<App />);
      await waitFor(() =>
        expect(
          screen.getByRole("complementary", { name: "Workspace explorer" }).textContent,
        ).toContain("Provider connected"),
      );
      fireEvent.change(screen.getByRole("textbox", { name: "Message Loom" }), {
        target: { value: "Edit file" },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Send message" }));
      });
      expect(await screen.findByText("workspace.writeFile")).toBeTruthy();
      const toolRequest = screen.getByRole("region", {
        name: "Tool request workspace.writeFile",
      });
      expect(
        toolRequest.querySelector(".tool-activity-actions")?.classList.contains("flex-wrap"),
      ).toBe(true);
      expect(screen.getByRole("banner", { name: "Session context" }).textContent).toContain(
        "Needs approval",
      );
      expect(screen.getByText("workspace.writeFile")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Approve once" }));
      await waitFor(() => expect(respondApproval).toHaveBeenCalledWith("call-1", true));
      expect(screen.getByRole("log").textContent).toContain("Approved once");
      await waitFor(() => {
        const saved = JSON.parse(localStorage.getItem("loom:conversations:v1") ?? "{}");
        expect(saved.conversations[0]?.toolApprovals?.[0]?.status).toBe("approved");
      });
      fireEvent.change(screen.getByRole("textbox", { name: "Message Loom" }), {
        target: { value: "Follow-up question" },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Send message" }));
      });
      await waitFor(() =>
        expect(screen.getByRole("log").textContent).toContain("Follow-up response"),
      );
      const timelineText = screen.getByRole("log").textContent ?? "";
      expect(timelineText.indexOf("Approved once")).toBeLessThan(
        timelineText.indexOf("Follow-up question"),
      );
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("keeps a rejected tool request visible in the conversation history", async () => {
    const priorApi = window.loomDesktop;
    const respondApproval = mock(async () => ({ accepted: true }));
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => null,
        list: async () => [],
        readFile: async () => ({ content: "" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "http://local/v1", model: "test", configured: true }),
        configure: async () => ({ configured: true, model: "test" }),
        stream: async (_runId, _request, onUpdate) => {
          onUpdate({
            approval: {
              id: "call-reject",
              toolName: "workspace.writeFile",
              arguments: { path: "secrets.txt", content: "private" },
            },
          });
        },
        cancel: async () => ({ cancelled: false }),
        respondApproval,
      },
    };
    try {
      render(<App />);
      await waitFor(() =>
        expect(
          screen.getByRole("complementary", { name: "Workspace explorer" }).textContent,
        ).toContain("Provider connected"),
      );
      fireEvent.change(screen.getByRole("textbox", { name: "Message Loom" }), {
        target: { value: "Do not edit this file" },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Send message" }));
      });
      fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
      await waitFor(() => expect(respondApproval).toHaveBeenCalledWith("call-reject", false));
      expect(screen.getByRole("log").textContent).toContain("Rejected");
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("invalidates a pending approval when its run is cancelled", async () => {
    const priorApi = window.loomDesktop;
    let finishStream: (() => void) | undefined;
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => null,
        list: async () => [],
        readFile: async () => ({ content: "" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "http://local/v1", model: "test", configured: true }),
        configure: async () => ({ configured: true, model: "test" }),
        stream: async (_runId, _request, onUpdate) => {
          onUpdate({
            approval: {
              id: "call-cancel",
              toolName: "workspace.writeFile",
              arguments: { path: "cancelled.txt" },
            },
          });
          await new Promise<void>((resolve) => {
            finishStream = resolve;
          });
        },
        cancel: async () => {
          finishStream?.();
          return { cancelled: true };
        },
        respondApproval: async () => ({ accepted: false }),
      },
    };
    try {
      render(<App />);
      await waitFor(() =>
        expect(
          screen.getByRole("complementary", { name: "Workspace explorer" }).textContent,
        ).toContain("Provider connected"),
      );
      fireEvent.change(screen.getByRole("textbox", { name: "Message Loom" }), {
        target: { value: "Write a file" },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Send message" }));
      });
      expect(await screen.findByRole("button", { name: "Approve once" })).toBeTruthy();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Stop run" }));
      });

      expect(screen.queryByRole("button", { name: "Approve once" })).toBeNull();
      expect(screen.getByRole("log").textContent).toContain("Approval unavailable");
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("switches between dark and light themes", () => {
    render(<App />);

    expect(document.querySelector(".loom-app")?.getAttribute("data-theme")).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));

    expect(document.querySelector(".loom-app")?.getAttribute("data-theme")).toBe("light");
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeTruthy();
    expect(localStorage.getItem("loom:theme:v1")).toBe("light");
  });

  test("can collapse the conversation sidebar", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Hide conversations" }));

    expect(screen.queryByRole("navigation", { name: "Conversations" })).toBeNull();
    expect(screen.getByRole("button", { name: "Show conversations" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "New chat" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Show conversations" }));
    expect(screen.getByRole("navigation", { name: "Conversations" })).toBeTruthy();
  });

  test("can collapse and restore the workspace explorer without breaking the center panel", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Hide workspace explorer" }));
    expect(screen.queryByRole("complementary", { name: "Workspace explorer" })).toBeNull();
    expect(screen.getByRole("button", { name: "Show workspace explorer" })).toBeTruthy();
    const workspaceTools = screen.getByRole("complementary", { name: "Workspace tools" });
    expect(workspaceTools).toBeTruthy();
    expect(within(workspaceTools).getByRole("button", { name: "Open workspace" })).toBeTruthy();
    expect(screen.getByRole("main", { name: "Conversation" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Show workspace explorer" }));
    expect(screen.getByRole("complementary", { name: "Workspace explorer" })).toBeTruthy();
  });

  test("restores collapsed side panels after remounting the app", async () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      private readonly callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe(target: Element) {
        this.callback(
          [{ target, contentRect: { width: 1280 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }

      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver;
    const mounted = render(<App />);
    try {
      const leftResize = screen.getByRole("separator", { name: "Resize conversation sidebar" });
      fireEvent.keyDown(leftResize, { key: "ArrowRight", shiftKey: true });
      fireEvent.click(screen.getByRole("button", { name: "Hide conversations" }));
      fireEvent.click(screen.getByRole("button", { name: "Hide workspace explorer" }));

      await waitFor(() => {
        expect(localStorage.getItem("loom:left-panel-open:v1")).toBe("false");
        expect(localStorage.getItem("loom:right-panel-open:v1")).toBe("false");
        expect(JSON.parse(localStorage.getItem("loom:panel-widths:v1") ?? "[]")).toEqual([
          288, 280,
        ]);
      });

      mounted.unmount();
      render(<App />);

      expect(screen.getByRole("complementary", { name: "Conversation tools" })).toBeTruthy();
      expect(screen.getByRole("complementary", { name: "Workspace tools" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Show conversations" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Show workspace explorer" })).toBeTruthy();
      expect(screen.getByRole("main", { name: "Conversation" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Show conversations" }));
      expect(
        screen
          .getByRole("separator", { name: "Resize conversation sidebar" })
          .getAttribute("aria-valuenow"),
      ).toBe("288");
    } finally {
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  test("keeps the explorer rail interactive after both sidebars are collapsed", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Hide conversations" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide workspace explorer" }));
    expect(screen.getByRole("complementary", { name: "Workspace tools" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show conversations" }));
    expect(screen.getByRole("navigation", { name: "Conversations" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show file explorer" }));
    expect(screen.getByRole("complementary", { name: "Workspace explorer" })).toBeTruthy();
  });

  test("keeps the folder action available from the collapsed explorer rail", async () => {
    render(<App />);

    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
        "button",
        { name: "Open workspace" },
      ),
    );
    selectWorkspaceFiles();
    fireEvent.click(screen.getByRole("button", { name: "Hide workspace explorer" }));

    const tools = screen.getByRole("complementary", { name: "Workspace tools" });
    expect(screen.getByRole("button", { name: "Show workspace explorer" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open another workspace" })).toBeTruthy();
    expect(tools.textContent).not.toContain("App.tsx");

    fireEvent.click(screen.getByRole("button", { name: "Show workspace explorer" }));
    expect(screen.getByText("src")).toBeTruthy();
    expect(screen.queryByText("App.tsx")).toBeNull();
    expandTreeFolder("src");
    expect(await screen.findByText("App.tsx")).toBeTruthy();
  });

  test("refreshes root entries in the workspace explorer", async () => {
    const priorApi = window.loomDesktop;
    const list = mock(async () => [{ name: "new.ts", path: "new.ts", isDir: false, size: 3 }]);
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list,
        readFile: async () => ({ content: "" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      await screen.findByText("new.ts");
      fireEvent.click(screen.getByRole("button", { name: "Refresh workspace files" }));
      await screen.findByRole("complementary", { name: "Workspace explorer" });
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("shows a workspace error when refreshing root entries fails", async () => {
    const priorApi = window.loomDesktop;
    const list = mock(async () => [
      { name: "notes.txt", path: "notes.txt", isDir: false, size: 1 },
    ]);
    list.mockImplementationOnce(async () => [
      { name: "notes.txt", path: "notes.txt", isDir: false, size: 1 },
    ]);
    list.mockImplementationOnce(async () => {
      throw new Error("Workspace access was denied.");
    });
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list,
        readFile: async () => ({ content: "" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      await screen.findByRole("complementary", { name: "Workspace explorer" });
      fireEvent.click(screen.getByRole("button", { name: "Refresh workspace files" }));

      expect((await screen.findByRole("alert")).textContent).toContain(
        "Workspace access was denied.",
      );
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("opens the folder chooser directly without a sample workspace dialog", async () => {
    render(<App />);

    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
        "button",
        { name: "Open workspace" },
      ),
    );
    const folderInput = screen.getByLabelText("Workspace folder input");
    expect(folderInput).toBeTruthy();
    expect(screen.queryByText(/Select a project folder/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Open sample" })).toBeNull();
    selectWorkspaceFiles();

    const explorer = screen.getByRole("complementary", { name: "Workspace explorer" });
    expect(explorer.textContent).toContain("sample-project");
    expect(explorer.textContent).toContain("src");
    expect(screen.queryByText("App.tsx")).toBeNull();
    expect(screen.queryByText("No workspace open")).toBeNull();
  });

  test("creates a new file in the open workspace and opens its editor tab", async () => {
    const priorApi = window.loomDesktop;
    const createFile = mock(async () => ({ created: true }));
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list: async () => [{ name: "src", path: "src", isDir: true, size: 0 }],
        readFile: async () => ({ content: "" }),
        writeFile: async () => ({ written: true }),
        createFile,
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      await screen.findByText("src");
      fireEvent.click(screen.getByRole("button", { name: "New file" }));
      fireEvent.change(screen.getByRole("textbox", { name: "New file path" }), {
        target: { value: "src/new.ts" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Create and open" }));

      expect(
        await screen.findByRole("textbox", { name: "Editor content src/new.ts" }),
      ).toBeTruthy();
      expect(createFile).toHaveBeenCalledWith("src/new.ts");
      expect(screen.getByRole("tab", { name: /new\.ts/ })).toBeTruthy();
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("keeps the new-file dialog open and shows the workspace error when creation fails", async () => {
    const priorApi = window.loomDesktop;
    const createFile = mock(async () => {
      throw new Error("The file already exists on disk.");
    });
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list: async () => [],
        readFile: async () => ({ content: "" }),
        writeFile: async () => ({ written: true }),
        createFile,
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      fireEvent.click(await screen.findByRole("button", { name: "New file" }));
      const dialog = screen.getByRole("dialog", { name: "Create a file" });
      fireEvent.change(within(dialog).getByRole("textbox", { name: "New file path" }), {
        target: { value: "already-there.ts" },
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Create and open" }));

      expect((await within(dialog).findByRole("alert")).textContent).toBe(
        "The file already exists on disk.",
      );
      expect(createFile).toHaveBeenCalledWith("already-there.ts");
      expect(screen.queryByRole("tab", { name: /already-there\.ts/ })).toBeNull();
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("creates a workspace folder from an explorer context menu", async () => {
    const priorApi = window.loomDesktop;
    const createDirectory = mock(async () => ({ created: true }));
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list: async () => [{ name: "src", path: "src", isDir: true, size: 0 }],
        readFile: async () => ({ content: "" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory,
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      await screen.findByText("src");
      fireEvent.contextMenu(screen.getByText("src"));
      fireEvent.click(await screen.findByRole("menuitem", { name: "New Folder" }));
      fireEvent.change(await screen.findByRole("textbox", { name: "New folder path" }), {
        target: { value: "src/components" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Create folder" }));
      await waitFor(() => expect(createDirectory).toHaveBeenCalledWith("src/components"));
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("keeps the create-folder dialog open and rejects an existing path", async () => {
    const priorApi = window.loomDesktop;
    const createDirectory = mock(async () => ({ created: true }));
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list: async () => [
          { name: "src", path: "src", isDir: true, size: 0 },
          { name: "notes.txt", path: "notes.txt", isDir: false, size: 8 },
        ],
        readFile: async () => ({ content: "notes" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory,
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      await screen.findByText("src");
      fireEvent.contextMenu(screen.getByText("src"));
      fireEvent.click(await screen.findByRole("menuitem", { name: "New Folder" }));
      const dialog = screen.getByRole("dialog", { name: "Create a folder" });
      fireEvent.change(within(dialog).getByRole("textbox", { name: "New folder path" }), {
        target: { value: "src" },
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Create folder" }));

      expect(await within(dialog).findByRole("alert")).toBeTruthy();
      expect(createDirectory).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog", { name: "Create a folder" })).toBeTruthy();
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("keyboard navigates and dismisses the workspace context menu", async () => {
    const priorApi = window.loomDesktop;
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list: async () => [{ name: "notes.txt", path: "notes.txt", isDir: false, size: 1 }],
        readFile: async () => ({ content: "x" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      const file = await screen.findByText("notes.txt");
      fireEvent.contextMenu(file);
      const newFile = await screen.findByRole("menuitem", { name: "New File" });

      expect(document.activeElement).toBe(newFile);
      fireEvent.keyDown(newFile, { key: "ArrowDown" });
      expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "New Folder" }));
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });

      expect(screen.queryByRole("menu")).toBeNull();
      expect(document.activeElement).toBe(file.closest('[role="treeitem"]'));
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("deletes a workspace file after confirmation from its context menu", async () => {
    const priorApi = window.loomDesktop;
    const remove = mock(async () => ({ deleted: true }));
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list: async () => [{ name: "notes.txt", path: "notes.txt", isDir: false, size: 1 }],
        readFile: async () => ({ content: "x" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: remove,
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      await screen.findByText("notes.txt");
      fireEvent.contextMenu(screen.getByText("notes.txt"));
      fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
      fireEvent.click(await screen.findByRole("button", { name: /^Delete$/ }));
      await waitFor(() => expect(remove).toHaveBeenCalledWith("notes.txt"));
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("keeps a workspace file listed and reports an error when deletion fails", async () => {
    const priorApi = window.loomDesktop;
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list: async () => [{ name: "notes.txt", path: "notes.txt", isDir: false, size: 1 }],
        readFile: async () => ({ content: "x" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => {
          throw new Error("Permission denied.");
        },
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      const file = await screen.findByText("notes.txt");
      fireEvent.contextMenu(file);
      fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
      fireEvent.click(await screen.findByRole("button", { name: /^Delete$/ }));

      expect((await screen.findByRole("alert")).textContent).toBe("Permission denied.");
      expect(screen.getByText("notes.txt")).toBeTruthy();
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("reports workspace file read errors without opening an editor tab", async () => {
    const priorApi = window.loomDesktop;
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list: async () => [{ name: "secret.txt", path: "secret.txt", isDir: false, size: 1 }],
        readFile: async () => {
          throw new Error("Could not read the selected file.");
        },
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      fireEvent.click(await screen.findByText("secret.txt"));

      expect((await screen.findByRole("alert")).textContent).toBe(
        "Could not read the selected file.",
      );
      expect(screen.queryByRole("tab", { name: "secret.txt" })).toBeNull();
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("closes open editor tabs when deleting their parent folder", async () => {
    const priorApi = window.loomDesktop;
    const remove = mock(async () => ({ deleted: true }));
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list: async (path: string) =>
          path === "."
            ? [{ name: "src", path: "src", isDir: true, size: 0 }]
            : [{ name: "main.ts", path: "src/main.ts", isDir: false, size: 8 }],
        readFile: async () => ({ content: "export const ready = true;" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: remove,
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      await screen.findByText("src");
      expandTreeFolder("src");
      const tree = screen.getByRole("tree", { name: "Workspace files" });
      fireEvent.click(await within(tree).findByRole("button", { name: "main.ts" }));
      expect(await screen.findByRole("tab", { name: "main.ts" })).toBeTruthy();

      const sourceFolder = within(tree).getByRole("button", { name: "src" });
      fireEvent.contextMenu(sourceFolder);
      fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
      const dialog = screen.getByRole("dialog", { name: "Delete workspace item?" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(remove).toHaveBeenCalledWith("src"));
      expect(screen.queryByRole("tab", { name: "main.ts" })).toBeNull();
      expect(screen.getByRole("textbox", { name: "Message Loom" })).toBeTruthy();
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("renames a workspace file and keeps its open editor tab attached", async () => {
    const priorApi = window.loomDesktop;
    let currentPath = "notes.txt";
    const rename = mock(async (_from: string, to: string) => {
      currentPath = to;
      return { renamed: true };
    });
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list: async () => [
          { name: currentPath.split("/").at(-1)!, path: currentPath, isDir: false, size: 1 },
        ],
        readFile: async () => ({ content: "keep the editor content" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename,
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      const tree = await screen.findByRole("tree", { name: "Workspace files" });
      const originalFile = await within(tree).findByRole("button", { name: "notes.txt" });
      fireEvent.click(originalFile);
      expect(await screen.findByRole("textbox", { name: "Editor content notes.txt" })).toBeTruthy();

      fireEvent.contextMenu(originalFile);
      fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
      const dialog = screen.getByRole("dialog", { name: "Rename workspace item" });
      fireEvent.change(within(dialog).getByRole("textbox", { name: "New item name" }), {
        target: { value: "notes-renamed.txt" },
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Rename" }));

      await waitFor(() => expect(rename).toHaveBeenCalledWith("notes.txt", "notes-renamed.txt"));
      expect(
        await screen.findByRole("textbox", { name: "Editor content notes-renamed.txt" }),
      ).toBeTruthy();
      expect(screen.getByRole("tabpanel", { name: "notes-renamed.txt" }).textContent).toContain(
        "keep the editor content",
      );
      expect(within(tree).getByRole("button", { name: "notes-renamed.txt" })).toBeTruthy();
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("renaming a workspace folder updates paths for open files inside it", async () => {
    const priorApi = window.loomDesktop;
    const rename = mock(async () => ({ renamed: true }));
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list: async (path: string) =>
          path === "."
            ? [{ name: "src", path: "src", isDir: true, size: 0 }]
            : [{ name: "main.ts", path: "src/main.ts", isDir: false, size: 8 }],
        readFile: async () => ({ content: "export const ready = true;" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename,
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      await screen.findByText("src");
      expandTreeFolder("src");
      const tree = screen.getByRole("tree", { name: "Workspace files" });
      const file = await within(tree).findByRole("button", { name: "main.ts" });
      fireEvent.click(file);
      expect(
        await screen.findByRole("textbox", { name: "Editor content src/main.ts" }),
      ).toBeTruthy();

      const sourceFolder = within(tree).getByRole("button", { name: "src" });
      fireEvent.contextMenu(sourceFolder);
      fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
      const dialog = screen.getByRole("dialog", { name: "Rename workspace item" });
      fireEvent.change(within(dialog).getByRole("textbox", { name: "New item name" }), {
        target: { value: "app" },
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Rename" }));

      await waitFor(() => expect(rename).toHaveBeenCalledWith("src", "app"));
      expect(
        await screen.findByRole("textbox", { name: "Editor content app/main.ts" }),
      ).toBeTruthy();
      expect(screen.getByRole("tabpanel", { name: "app/main.ts" }).textContent).toContain(
        "export const ready = true;",
      );
      expect(within(tree).getByRole("button", { name: "app" })).toBeTruthy();
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("keeps the rename dialog open when the destination name already exists", async () => {
    const priorApi = window.loomDesktop;
    const rename = mock(async () => ({ renamed: true }));
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list: async () => [
          { name: "first.txt", path: "first.txt", isDir: false, size: 1 },
          { name: "second.txt", path: "second.txt", isDir: false, size: 1 },
        ],
        readFile: async () => ({ content: "" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename,
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      const tree = await screen.findByRole("tree", { name: "Workspace files" });
      const original = await within(tree).findByRole("button", { name: "first.txt" });
      fireEvent.contextMenu(original);
      fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
      const dialog = screen.getByRole("dialog", { name: "Rename workspace item" });
      fireEvent.change(within(dialog).getByRole("textbox", { name: "New item name" }), {
        target: { value: "second.txt" },
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Rename" }));

      expect(within(dialog).getByRole("alert").textContent).toContain("already exists");
      expect(rename).not.toHaveBeenCalled();
      expect(within(tree).getByRole("button", { name: "first.txt" })).toBeTruthy();
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("loads a workspace folder when it is expanded in the right explorer", async () => {
    const priorApi = window.loomDesktop;
    const list = mock(async (path: string) =>
      path === "."
        ? [{ name: "src", path: "src", isDir: true, size: 0 }]
        : [{ name: "main.ts", path: "src/main.ts", isDir: false, size: 12 }],
    );
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list,
        readFile: async () => ({ content: "export const ready = true;" }),
        writeFile: async () => ({ written: true }),
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };

    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      await screen.findByText("src");
      expect(list).not.toHaveBeenCalledWith("src");
      fireEvent.click(screen.getByRole("button", { name: "Expand src" }));

      expect(await screen.findByText("main.ts")).toBeTruthy();
      expect(list).toHaveBeenCalledWith("src");
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("starts a fresh conversation", () => {
    render(<App />);
    const composer = screen.getByRole("textbox", { name: "Message Loom" });
    fireEvent.change(composer, { target: { value: "First conversation" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    fireEvent.click(screen.getByRole("button", { name: /New chat/ }));

    expect(screen.getByRole("navigation", { name: "Conversations" }).textContent).toContain(
      "First conversation",
    );
    expect(screen.getByRole("heading", { name: "What are we building today?" })).toBeTruthy();
  });

  test("does not load messages from local storage before runtime integration", () => {
    localStorage.setItem(
      "loom:conversations:v1",
      JSON.stringify([{ id: "saved", title: "Saved thread", messages: ["Saved locally"] }]),
    );

    render(<App />);

    expect(screen.getByRole("heading", { name: "What are we building today?" })).toBeTruthy();
    expect(screen.queryByText("Saved locally") === null).toBe(true);
  });

  test("switches between conversations during the current app session", () => {
    render(<App />);
    const composer = screen.getByRole("textbox", { name: "Message Loom" });
    fireEvent.change(composer, { target: { value: "First conversation" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.click(screen.getByRole("button", { name: /New chat/ }));
    fireEvent.change(composer, { target: { value: "Second conversation" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.click(screen.getByRole("button", { name: "First conversation" }));

    expect(screen.getByRole("log").textContent).toContain("First conversation");
    expect(screen.getByRole("log").textContent?.includes("Second conversation")).toBe(false);
  });

  test("shows saved sessions as tabs and keeps the active title and New chat in sync", () => {
    localStorage.setItem(
      "loom:conversations:v1",
      JSON.stringify({
        conversations: [
          {
            id: "first",
            title: "First chat",
            messages: [{ role: "user", content: "First message" }],
          },
          {
            id: "second",
            title: "Second chat",
            messages: [{ role: "user", content: "Second message" }],
          },
        ],
        activeConversationId: "first",
      }),
    );
    render(<App />);

    const sessionTabs = screen.getByRole("tablist", { name: "Session tabs" });
    const first = within(sessionTabs).getByRole("tab", { name: "First chat" });
    const second = within(sessionTabs).getByRole("tab", { name: "Second chat" });
    expect(first.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("banner", { name: "Session context" }).textContent).toContain(
      "First chat",
    );

    act(() => first.focus());
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(document.activeElement).toBe(second);
    expect(second.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("banner", { name: "Session context" }).textContent).toContain(
      "Second chat",
    );
    expect(screen.getByRole("log").textContent).toContain("Second message");

    fireEvent.click(first);
    expect(first.getAttribute("aria-selected")).toBe("true");
    fireEvent.click(second);

    fireEvent.click(
      within(sessionTabs.parentElement!).getByRole("button", { name: "Create chat" }),
    );
    expect(screen.getByRole("banner", { name: "Session context" }).textContent).toContain(
      "New chat",
    );
    expect(screen.getByRole("heading", { name: "What are we building today?" })).toBeTruthy();
    expect(within(sessionTabs).getAllByRole("tab")).toHaveLength(3);
  });

  test("scrolls the active session tab into view when switching chats", () => {
    localStorage.setItem(
      "loom:conversations:v1",
      JSON.stringify({
        conversations: [
          {
            id: "first",
            title: "First chat",
            messages: [{ role: "user", content: "First message" }],
          },
          {
            id: "second",
            title: "Second chat",
            messages: [{ role: "user", content: "Second message" }],
          },
        ],
        activeConversationId: "first",
      }),
    );
    render(<App />);

    const sessionTabs = screen.getByRole("tablist", { name: "Session tabs" });
    const second = within(sessionTabs).getByRole("tab", { name: "Second chat" });
    const scrollIntoView = mock(() => undefined);
    Object.defineProperty(second, "scrollIntoView", { configurable: true, value: scrollIntoView });

    fireEvent.click(second);

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
  });

  test("keeps New chat available beside saved tabs and restores its unsent draft", () => {
    localStorage.setItem(
      "loom:conversations:v1",
      JSON.stringify({
        conversations: [
          {
            id: "first",
            title: "First chat",
            messages: [{ role: "user", content: "First message" }],
          },
          {
            id: "second",
            title: "Second chat",
            messages: [{ role: "user", content: "Second message" }],
          },
        ],
        activeConversationId: "first",
      }),
    );
    render(<App />);

    const sessionTabs = screen.getByRole("tablist", { name: "Session tabs" });
    const newChat = within(sessionTabs).getByRole("tab", { name: "New chat" });
    fireEvent.click(newChat);
    const composer = screen.getByRole("textbox", { name: "Message Loom" });
    fireEvent.change(composer, { target: { value: "Draft for later" } });

    fireEvent.click(within(sessionTabs).getByRole("tab", { name: "Second chat" }));
    expect(screen.getByRole("log").textContent).toContain("Second message");
    expect(within(sessionTabs).getByRole("tab", { name: "New chat" })).toBeTruthy();

    fireEvent.click(within(sessionTabs).getByRole("tab", { name: "New chat" }));
    expect((composer as HTMLTextAreaElement).value).toBe("Draft for later");
  });

  test("navigates conversations with arrow and Home/End keys", () => {
    localStorage.setItem(
      "loom:conversations:v1",
      JSON.stringify({
        conversations: [
          {
            id: "chat-first",
            title: "First chat",
            messages: [{ role: "user", content: "First message" }],
          },
          {
            id: "chat-second",
            title: "Second chat",
            messages: [{ role: "user", content: "Second message" }],
          },
          {
            id: "chat-third",
            title: "Third chat",
            messages: [{ role: "user", content: "Third message" }],
          },
        ],
        activeConversationId: "chat-first",
      }),
    );
    render(<App />);
    const first = screen.getByRole("button", { name: "First chat" });
    const second = screen.getByRole("button", { name: "Second chat" });
    const third = screen.getByRole("button", { name: "Third chat" });

    act(() => first.focus());
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement === second).toBe(true);
    expect(second.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("log").textContent).toContain("Second message");

    fireEvent.keyDown(second, { key: "End" });
    expect(document.activeElement === third).toBe(true);
    fireEvent.keyDown(third, { key: "Home" });
    expect(document.activeElement === first).toBe(true);
    fireEvent.keyDown(first, { key: "ArrowUp" });
    expect(document.activeElement === first).toBe(true);
    const firstTitle = first.querySelector(".conversation-title-track");
    fireEvent.keyDown(firstTitle!, { key: "ArrowDown" });
    expect(document.activeElement === second).toBe(true);
    expect(screen.getByRole("log").textContent).toContain("Second message");
  });

  test("keeps an unsent composer draft with its conversation when switching sessions", () => {
    render(<App />);
    const composer = screen.getByRole("textbox", { name: "Message Loom" });
    fireEvent.change(composer, { target: { value: "First conversation" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.change(composer, { target: { value: "Draft for first chat" } });

    fireEvent.click(screen.getByRole("button", { name: /New chat/ }));
    expect((composer as HTMLTextAreaElement).value).toBe("");
    fireEvent.change(composer, { target: { value: "Draft for second chat" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.change(composer, { target: { value: "Unsent follow-up" } });
    fireEvent.click(screen.getByRole("button", { name: "First conversation" }));
    expect((composer as HTMLTextAreaElement).value).toBe("Draft for first chat");

    fireEvent.click(screen.getByRole("button", { name: "Draft for second chat" }));
    expect((composer as HTMLTextAreaElement).value).toBe("Unsent follow-up");
  });

  test("filters recent conversations by the search query", () => {
    localStorage.setItem(
      "loom:conversations:v1",
      JSON.stringify({
        conversations: [
          {
            id: "welcome",
            title: "Welcome to Loom",
            messages: [{ role: "user", content: "Welcome to Loom" }],
          },
        ],
        activeConversationId: "welcome",
      }),
    );
    render(<App />);

    fireEvent.change(screen.getByRole("textbox", { name: "Search conversations" }), {
      target: { value: "   " },
    });
    expect(screen.getByRole("button", { name: "Welcome to Loom" })).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "Search conversations" }), {
      target: { value: "missing" },
    });

    expect(screen.queryByRole("button", { name: /Welcome to Loom/ })).toBeNull();
    expect(screen.getByText("No conversations match your search.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(screen.getByRole("button", { name: "Welcome to Loom" })).toBeTruthy();
    expect(
      (screen.getByRole("textbox", { name: "Search conversations" }) as HTMLInputElement).value,
    ).toBe("");
  });

  test("opens gateway settings from the sidebar", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));

    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Settings categories" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Gateway" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Gateway connection")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect provider" })).toBeTruthy();
  });

  test("settings supports Escape dismissal and restores focus to its opener", () => {
    render(<App />);
    const opener = screen.getByRole("button", { name: /Settings/ });
    opener.focus();
    fireEvent.click(opener);
    const settings = screen.getByRole("dialog", { name: "Settings" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close settings" }));

    fireEvent.keyDown(settings, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  test("settings categories switch sections and update appearance preferences", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    expect(screen.getByRole("region", { name: "Appearance settings" })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Switch to light theme" })
        .classList.contains("bg-[var(--loom-accent)]"),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));
    expect(document.querySelector(".loom-app")?.getAttribute("data-theme")).toBe("light");
  });

  test("keeps the Settings default model selector in sync with the composer", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    fireEvent.click(screen.getByRole("button", { name: "Models" }));

    const defaultModel = screen.getByRole("combobox", { name: "Default model" });
    expect(
      Array.from((defaultModel as HTMLSelectElement).options).map((option) => option.text),
    ).toEqual(["Gateway model", "Gateway fast", "Gateway reasoning"]);
    fireEvent.change(defaultModel, { target: { value: "Gateway fast" } });
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));

    expect((screen.getByRole("combobox", { name: "Model" }) as HTMLSelectElement).value).toBe(
      "Gateway fast",
    );
  });

  test("moves through Settings categories with arrow and boundary keys", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    const categories = screen.getByRole("navigation", { name: "Settings categories" });
    const providers = within(categories).getByRole("button", { name: "Providers" });
    const models = within(categories).getByRole("button", { name: "Models" });
    const appearance = within(categories).getByRole("button", { name: "Appearance" });
    const about = within(categories).getByRole("button", { name: "About" });

    act(() => providers.focus());
    fireEvent.keyDown(providers, { key: "ArrowRight" });
    expect(document.activeElement).toBe(models);
    expect(models.getAttribute("aria-current")).toBe("page");

    fireEvent.keyDown(models, { key: "ArrowDown" });
    expect(document.activeElement).toBe(appearance);
    expect(screen.getByRole("region", { name: "Appearance settings" })).toBeTruthy();

    fireEvent.keyDown(appearance, { key: "End" });
    expect(document.activeElement).toBe(about);
    expect(screen.getByRole("region", { name: "About settings" })).toBeTruthy();

    fireEvent.keyDown(about, { key: "Home" });
    expect(document.activeElement).toBe(providers);
    expect(screen.getByRole("button", { name: "Providers" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  test("keeps the focused Settings category visible while navigating by keyboard", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    const categories = screen.getByRole("navigation", { name: "Settings categories" });
    const providers = within(categories).getByRole("button", { name: "Providers" });
    const models = within(categories).getByRole("button", { name: "Models" });
    const scrollIntoView = mock(() => undefined);
    Object.defineProperty(models, "scrollIntoView", { configurable: true, value: scrollIntoView });

    providers.focus();
    fireEvent.keyDown(providers, { key: "ArrowRight" });

    expect(document.activeElement).toBe(models);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
  });

  test("uses compact Settings navigation without forcing the desktop dialog full-screen", () => {
    const stylesheet = readFileSync(fileURLToPath(new URL("./App.css", import.meta.url)), "utf8");
    const compactSettings = stylesheet.match(
      /@media \(max-width: (\d+)px\) \{\s*\.settings-layout/,
    );
    const fullScreenSettings = stylesheet.match(
      /@media \(max-width: (\d+)px\) \{\s*\.settings-overlay/,
    );

    expect(compactSettings?.[1]).toBe("900");
    expect(fullScreenSettings?.[1]).toBe("640");
  });

  test("appearance settings control and persist the workbench panel visibility", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));

    const conversations = screen.getByRole("checkbox", { name: "Show conversations" });
    const explorer = screen.getByRole("checkbox", { name: "Show workspace explorer" });
    expect((conversations as HTMLInputElement).checked).toBe(true);
    expect((explorer as HTMLInputElement).checked).toBe(true);

    fireEvent.click(conversations);
    fireEvent.click(explorer);

    expect((conversations as HTMLInputElement).checked).toBe(false);
    expect((explorer as HTMLInputElement).checked).toBe(false);
    expect(localStorage.getItem("loom:left-panel-open:v1")).toBe("false");
    expect(localStorage.getItem("loom:right-panel-open:v1")).toBe("false");
    expect(
      within(screen.getByRole("complementary", { name: "Conversation tools" })).getByRole(
        "button",
        { name: "New chat" },
      ),
    ).toBeTruthy();
    const workspaceTools = screen.getByRole("complementary", { name: "Workspace tools" });
    expect(
      within(workspaceTools).getByRole("button", { name: "Show workspace explorer" }),
    ).toBeTruthy();
    expect(within(workspaceTools).getByRole("button", { name: "Open workspace" })).toBeTruthy();
  });

  test("describes workspace information in the About settings", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    fireEvent.click(screen.getByRole("button", { name: "About" }));

    expect(screen.getByRole("region", { name: "About settings" }).textContent).toContain(
      "workspace information",
    );
    expect(screen.getByRole("region", { name: "About settings" }).textContent).not.toContain(
      "project information",
    );
  });

  test("opens a preview for a workspace file", async () => {
    render(<App />);
    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
        "button",
        { name: "Open workspace" },
      ),
    );
    selectWorkspaceFiles();
    expandTreeFolder("src");
    fireEvent.click(await screen.findByText("App.tsx"));

    expect(await screen.findByRole("tab", { name: /App.tsx/ })).toBeTruthy();
    expect(
      screen.getByRole("textbox", { name: "Editor content src/App.tsx" }).textContent,
    ).toContain("Hello, Loom");
    expect(
      screen.getByRole("tabpanel", { name: "src/App.tsx" }).querySelector(".cm-lineNumbers")
        ?.textContent,
    ).toContain("123");
  });

  test("navigates open editor tabs with arrow and boundary keys", async () => {
    render(<App />);
    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
        "button",
        { name: "Open workspace" },
      ),
    );
    selectWorkspaceFiles();
    expandTreeFolder("src");
    fireEvent.click(await screen.findByText("App.tsx"));
    fireEvent.click(screen.getByText("main.tsx"));

    const mainTab = await screen.findByRole("tab", { name: "main.tsx" });
    fireEvent.keyDown(mainTab, { key: "ArrowLeft" });

    const appTab = screen.getByRole("tab", { name: "App.tsx" });
    expect(appTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(appTab);
    fireEvent.keyDown(appTab, { key: "End" });
    expect(screen.getByRole("tab", { name: "main.tsx" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  test("returns focus to Chat after closing the active editor tab", async () => {
    render(<App />);
    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
        "button",
        { name: "Open workspace" },
      ),
    );
    selectWorkspaceFiles();
    expandTreeFolder("src");
    fireEvent.click(await screen.findByText("App.tsx"));
    fireEvent.click(screen.getByText("main.tsx"));
    await screen.findByRole("tab", { name: "main.tsx" });

    fireEvent.click(screen.getByRole("button", { name: "Close main.tsx" }));

    const chatTab = screen.getByRole("tab", { name: "Chat" });
    expect(chatTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement === chatTab).toBe(true);
    expect(screen.getByRole("tabpanel", { name: "Chat" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "App.tsx" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close App.tsx" }));
    const composer = screen.getByRole("textbox", { name: "Message Loom" });
    expect(document.activeElement === composer).toBe(true);
    expect(screen.queryByRole("tablist", { name: "Open views" })).toBeNull();
  });

  test("navigates the workspace tree with arrow keys and expands folders", async () => {
    render(<App />);
    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
        "button",
        { name: "Open workspace" },
      ),
    );
    selectWorkspaceFiles();

    const tree = await screen.findByRole("tree", { name: "Workspace files" });
    const sourceFolder = within(tree).getAllByRole("treeitem")[0];
    if (!sourceFolder) {
      throw new Error("Workspace tree did not render its root folder");
    }
    sourceFolder.focus();
    expect(document.activeElement === sourceFolder).toBe(true);
    fireEvent.keyDown(sourceFolder, { key: "ArrowUp" });
    expect(document.activeElement === sourceFolder).toBe(true);
    expect(sourceFolder.getAttribute("aria-expanded")).toBe("false");
    fireEvent.keyDown(sourceFolder, { key: "ArrowRight" });

    const srcContents = await screen.findByRole("group", { name: "src contents" });
    expect(sourceFolder.getAttribute("aria-expanded")).toBe("true");
    const appFile = within(srcContents).getAllByRole("treeitem")[0];
    if (!appFile) {
      throw new Error("Expanded source folder did not render its first file");
    }
    fireEvent.keyDown(sourceFolder, { key: "ArrowRight" });
    expect(document.activeElement).toBe(appFile);

    fireEvent.keyDown(appFile, { key: "ArrowDown" });
    const mainFile = within(srcContents).getAllByRole("treeitem")[1];
    if (!mainFile) {
      throw new Error("Expanded source folder did not render its second file");
    }
    expect(document.activeElement).toBe(mainFile);
    fireEvent.keyDown(mainFile, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(sourceFolder);
    fireEvent.keyDown(sourceFolder, { key: "ArrowLeft" });
    expect(screen.queryByRole("group", { name: "src contents" })).toBeNull();
    fireEvent.keyDown(sourceFolder, { key: "ArrowRight" });
    expect(screen.getByRole("group", { name: "src contents" })).toBeTruthy();
    fireEvent.keyDown(sourceFolder, { key: "End" });
    const lastTreeItem = within(tree).getAllByRole("treeitem").at(-1);
    if (!lastTreeItem) {
      throw new Error("Workspace tree did not render its last visible tree item");
    }
    expect(document.activeElement).toBe(lastTreeItem);
    fireEvent.keyDown(lastTreeItem, { key: "ArrowDown" });
    expect(document.activeElement === lastTreeItem).toBe(true);

    const appTreeItem = within(screen.getByRole("group", { name: "src contents" })).getAllByRole(
      "treeitem",
    )[0];
    if (!appTreeItem) {
      throw new Error("Expanded source folder did not render the App.tsx tree item");
    }
    fireEvent.keyDown(appTreeItem, { key: "Enter" });
    expect(await screen.findByRole("tab", { name: "App.tsx" })).toBeTruthy();
  });

  test("can approve or reject a mock tool request", () => {
    render(<App />);
    const composer = screen.getByRole("textbox", { name: "Message Loom" });
    fireEvent.change(composer, { target: { value: "Inspect the project" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview tool approval" }));

    expect(screen.getByText("Write src/App.tsx")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approve once" }));

    expect(screen.queryByText("Proposed edit · src/App.tsx") !== null).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Accept changes" }));
    expect(screen.getByText("Changes accepted in preview. No files were changed.")).toBeTruthy();
  });

  test("can reject a mock tool request", () => {
    render(<App />);
    const composer = screen.getByRole("textbox", { name: "Message Loom" });
    fireEvent.change(composer, { target: { value: "Inspect the project" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview tool approval" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(screen.getByText("Request rejected. No files were changed.")).toBeTruthy();
  });

  test("can reject a proposed diff after approving the mock tool request", () => {
    render(<App />);
    const composer = screen.getByRole("textbox", { name: "Message Loom" });
    fireEvent.change(composer, { target: { value: "Rename the welcome title" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview tool approval" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve once" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject changes" }));

    expect(screen.getByText("Changes rejected. No files were changed.")).toBeTruthy();
  });

  test("keeps pending approval state with its conversation during the current app session", () => {
    render(<App />);
    const composer = screen.getByRole("textbox", { name: "Message Loom" });
    fireEvent.change(composer, { target: { value: "Inspect a file" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview tool approval" }));

    fireEvent.click(screen.getByRole("button", { name: /New chat/ }));
    expect(screen.queryByRole("button", { name: "Approve once" }) === null).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Inspect a file" }));
    expect(screen.getByRole("button", { name: "Approve once" })).toBeTruthy();
  });

  test("opens the folder chooser directly with the desktop shortcut", async () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "o", ctrlKey: true, shiftKey: true });

    expect(screen.getByLabelText("Workspace folder input")).toBeTruthy();
    expect(screen.queryByText(/Select a project folder/)).toBeNull();
  });

  test("approve-for-me mode opens the proposed diff without a separate approval prompt", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Run options" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Approval mode" }), {
      target: { value: "approve-me" },
    });
    const composer = screen.getByRole("textbox", { name: "Message Loom" });
    fireEvent.change(composer, { target: { value: "Change the welcome title" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview tool approval" }));

    expect(screen.queryByRole("button", { name: "Approve once" }) === null).toBe(true);
    expect(screen.queryByText("Proposed edit · src/App.tsx") !== null).toBe(true);
  });

  test("full-access mode accepts the local preview change immediately", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Run options" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Approval mode" }), {
      target: { value: "full-access" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Message Loom" }), {
      target: { value: "Update the welcome title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview tool approval" }));

    expect(screen.getByText("Changes accepted in preview. No files were changed.")).toBeTruthy();
  });

  test("settings contains account and gateway sections", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));

    expect(screen.getByRole("tab", { name: "Account" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Gateway" })).toBeTruthy();
  });

  test("settings tabs can be changed with arrow keys", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    const accountTab = screen.getByRole("tab", { name: "Account" });
    accountTab.focus();

    fireEvent.keyDown(accountTab, { key: "ArrowRight" });

    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Gateway" }));
    expect(screen.getByRole("tabpanel", { name: "Gateway" })).toBeTruthy();
  });

  test("application menus skip disabled actions and support keyboard navigation", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "File" }));
    expect((document.activeElement as HTMLElement).textContent).toBe("Open Workspace…");

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toBe("Create Workspace…");

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowDown" });

    expect(document.activeElement).toBe(
      screen.getByRole("menuitemcheckbox", { name: "Auto Save" }),
    );
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "File menu" })).toBeNull();
  });

  test("keeps model and add controls visible and discloses advanced run settings on demand", () => {
    render(<App />);

    expect(
      screen.getByRole("combobox", { name: "Model" }).closest(".composer-options"),
    ).toBeTruthy();
    expect(
      screen.getByRole("combobox", { name: "Model" }).classList.contains("composer-model-select"),
    ).toBe(true);
    expect(screen.getByRole("button", { name: "Add plugin or MCP" })).toBeTruthy();
    const options = screen.getByRole("button", { name: "Run options" });
    expect(options.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("combobox", { name: "Reasoning effort" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Approval mode" })).toBeNull();

    fireEvent.click(options);
    expect(screen.getByRole("combobox", { name: "Reasoning effort" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Approval mode" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Run options" }).getAttribute("aria-expanded")).toBe(
      "true",
    );
  });

  test("adds an MCP entry to the local preview", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Add plugin or MCP" }));
    fireEvent.click(await screen.findByText("Add MCP server"));
    fireEvent.change(await screen.findByRole("textbox", { name: "MCP server name" }), {
      target: { value: "Local tools" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add MCP server" }));

    expect(screen.getByText("MCP: Local tools")).toBeTruthy();
  });

  test("opens a selected local folder file in the center editor", async () => {
    render(<App />);
    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
        "button",
        { name: "Open workspace" },
      ),
    );
    const file = new File(["export const answer = 42;"], "answer.ts", { type: "text/plain" });
    Object.defineProperty(file, "webkitRelativePath", {
      value: "sample-project/src/answer.ts",
    });
    Object.defineProperty(file, "text", { value: async () => "export const answer = 42;" });
    fireEvent.change(screen.getByLabelText("Workspace folder input"), {
      target: { files: [file] },
    });
    expandTreeFolder("src");
    fireEvent.click(await screen.findByText("answer.ts"));

    const editor = await screen.findByRole("textbox", { name: "Editor content src/answer.ts" });
    await waitFor(() => expect(readEditorText(editor)).toContain("42"));
    expect(screen.getByRole("treeitem", { name: "answer.ts" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  test("renders line numbers for the active code editor", async () => {
    render(<App />);
    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
        "button",
        { name: "Open workspace" },
      ),
    );
    const file = new File(["const first = 1;\nconst second = 2;"], "lines.ts", {
      type: "text/plain",
    });
    Object.defineProperty(file, "webkitRelativePath", { value: "lines-project/lines.ts" });
    fireEvent.change(screen.getByLabelText("Workspace folder input"), {
      target: { files: [file] },
    });
    fireEvent.click(await screen.findByText("lines.ts"));
    await screen.findByRole("tab", { name: /lines\.ts/ });
    await screen.findByRole("textbox", { name: "Editor content lines.ts" });

    const lineNumbers = screen
      .getByRole("tabpanel", { name: "lines.ts" })
      .querySelector(".cm-lineNumbers")!;
    expect(lineNumbers.textContent).toContain("12");
  });

  test("finds text and navigates to a requested line in the active file", async () => {
    render(<App />);
    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
        "button",
        { name: "Open workspace" },
      ),
    );
    const file = new File(
      ["const first = 1;\nconst second = 2;\nreturn first + second;\nreturn first;"],
      "find.ts",
      {
        type: "text/plain",
      },
    );
    Object.defineProperty(file, "webkitRelativePath", { value: "find-project/find.ts" });
    fireEvent.change(screen.getByLabelText("Workspace folder input"), {
      target: { files: [file] },
    });
    fireEvent.click(await screen.findByText("find.ts"));
    await screen.findByRole("tab", { name: /find\.ts/ });
    await screen.findByRole("textbox", { name: "Editor content find.ts" });

    fireEvent.click(screen.getByRole("button", { name: "Find in file" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Find in file" }), {
      target: { value: "return" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find next" }));
    expect((await screen.findByRole("status", { name: "Editor cursor" })).textContent).toContain(
      "Match 1 of 2",
    );
    fireEvent.click(screen.getByRole("button", { name: "Find next" }));
    expect(screen.getByRole("status", { name: "Editor cursor" }).textContent).toContain(
      "Match 2 of 2",
    );

    fireEvent.click(screen.getByRole("button", { name: "Go to line" }));
    fireEvent.change(screen.getByLabelText("Line number"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(screen.getByRole("status", { name: "Editor cursor" }).textContent).toContain("Line 2");
  });

  test("opens file search and line navigation with editor shortcuts", async () => {
    render(<App />);
    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
        "button",
        { name: "Open workspace" },
      ),
    );
    const file = new File(["first\nsecond"], "shortcuts.txt", { type: "text/plain" });
    Object.defineProperty(file, "webkitRelativePath", { value: "shortcuts-project/shortcuts.txt" });
    fireEvent.change(screen.getByLabelText("Workspace folder input"), {
      target: { files: [file] },
    });
    fireEvent.click(await screen.findByText("shortcuts.txt"));
    await screen.findByRole("tab", { name: /shortcuts\.txt/ });

    fireEvent.keyDown(window, { key: "f", ctrlKey: true });
    expect(screen.getByRole("textbox", { name: "Find in file" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Find in file" }), { key: "Escape" });
    fireEvent.keyDown(window, { key: "g", ctrlKey: true });
    expect(screen.getByLabelText("Line number")).toBeTruthy();
  });

  test("replaces every matching occurrence in the active file", async () => {
    render(<App />);
    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
        "button",
        { name: "Open workspace" },
      ),
    );
    const file = new File(["blue blue\nblue"], "colors.txt", { type: "text/plain" });
    Object.defineProperty(file, "webkitRelativePath", { value: "colors-project/colors.txt" });
    fireEvent.change(screen.getByLabelText("Workspace folder input"), {
      target: { files: [file] },
    });
    fireEvent.click(await screen.findByText("colors.txt"));
    await screen.findByRole("textbox", { name: "Editor content colors.txt" });

    fireEvent.click(screen.getByRole("button", { name: "Replace in file" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Find in file" }), {
      target: { value: "blue" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Replace with" }), {
      target: { value: "green" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Replace all" }));

    expect(readEditorText(screen.getByRole("textbox", { name: "Editor content colors.txt" }))).toBe(
      "green green\ngreen",
    );
    expect(screen.getByRole("status", { name: "Editor cursor" }).textContent).toContain(
      "3 matches replaced",
    );
  });

  test("opens large local text files without an arbitrary preview size cap", async () => {
    render(<App />);
    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
        "button",
        { name: "Open workspace" },
      ),
    );
    const content = `const source = "${"x".repeat(1_100_000)}";`;
    const file = new File([content], "large.ts", { type: "text/plain" });
    Object.defineProperty(file, "webkitRelativePath", { value: "large-project/src/large.ts" });
    Object.defineProperty(file, "text", { value: async () => content });
    fireEvent.change(screen.getByLabelText("Workspace folder input"), {
      target: { files: [file] },
    });
    expandTreeFolder("src");
    fireEvent.click(await screen.findByText("large.ts"));

    await screen.findByRole("textbox", {
      name: "Editor content src/large.ts",
    });
    fireEvent.click(screen.getByRole("button", { name: "Find in file" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Find in file" }), {
      target: { value: 'xxxxxxxx";' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find next" }));
    expect(screen.getByRole("status", { name: "Editor cursor" }).textContent).toContain(
      "Match 1 of 1",
    );
  });

  test("shows a clear message when a local file exceeds the 50 MiB editor limit", async () => {
    render(<App />);
    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
        "button",
        { name: "Open workspace" },
      ),
    );
    const file = new File(["x"], "too-large.ts", { type: "text/plain" });
    Object.defineProperties(file, {
      size: { value: 50 * 1024 * 1024 + 1 },
      webkitRelativePath: { value: "large-project/src/too-large.ts" },
      text: { value: async () => "x" },
    });
    fireEvent.change(screen.getByLabelText("Workspace folder input"), {
      target: { files: [file] },
    });
    expandTreeFolder("src");
    fireEvent.click(await screen.findByText("too-large.ts"));

    expect((await screen.findByRole("alert")).textContent).toContain("50 MiB");
  });

  test("keeps the workspace tree expandable in the right explorer and opens files in the editor", async () => {
    render(<App />);

    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
        "button",
        { name: "Open workspace" },
      ),
    );
    selectWorkspaceFiles();

    const explorer = screen.getByRole("complementary", { name: "Workspace explorer" });
    expect(explorer.textContent).toContain("sample-project");
    expect(screen.queryByText("App.tsx")).toBeNull();
    expandTreeFolder("src");
    fireEvent.click(await screen.findByText("App.tsx"));

    expect(await screen.findByRole("textbox", { name: "Editor content src/App.tsx" })).toBeTruthy();
    await waitFor(() =>
      expect(
        screen
          .getByRole("textbox", { name: "Editor content src/App.tsx" })
          .querySelector(".loom-syntax-keyword")?.textContent,
      ).toBe("function"),
    );
    expect(screen.getByRole("tablist", { name: "Open views" }).textContent).toContain("Chat");
  });

  test("edits an open file and keeps its session changes when switching tabs", async () => {
    render(<App />);

    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
        "button",
        { name: "Open workspace" },
      ),
    );
    selectWorkspaceFiles();
    expandTreeFolder("src");
    fireEvent.click(await screen.findByText("App.tsx"));

    const editor = await screen.findByRole("textbox", { name: "Editor content src/App.tsx" });
    expect(editor.querySelector(".loom-syntax-keyword")?.textContent).toBe("function");
    await enterEditorText(editor, "export const changed = true;");

    expect(editor.textContent).toBe("export const changed = true;");
    expect(screen.getByText(/Unsaved session changes/)).toBeTruthy();

    fireEvent.click(
      screen.getByRole("tablist", { name: "Open views" }).querySelector('[role="tab"]')!,
    );
    fireEvent.click(screen.getByRole("tab", { name: /App\.tsx/ }));

    expect(screen.getByRole("textbox", { name: "Editor content src/App.tsx" }).textContent).toBe(
      "export const changed = true;",
    );
  });

  test("undoes and redoes editor changes and restores the saved dirty state", async () => {
    render(<App />);
    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
        "button",
        { name: "Open workspace" },
      ),
    );
    const original = "const value = 1;";
    const file = new File([original], "history.ts", { type: "text/plain" });
    const otherFile = new File(["const other = 0;"], "other.ts", { type: "text/plain" });
    Object.defineProperty(file, "webkitRelativePath", { value: "history-project/history.ts" });
    Object.defineProperty(otherFile, "webkitRelativePath", { value: "history-project/other.ts" });
    fireEvent.change(screen.getByLabelText("Workspace folder input"), {
      target: { files: [file, otherFile] },
    });
    fireEvent.click(await screen.findByText("history.ts"));
    const editor = await screen.findByRole("textbox", { name: "Editor content history.ts" });
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(true);
    await enterEditorText(editor, "const value = 2;");
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(readEditorText(editor)).toBe(original));
    expect(screen.queryByText(/Unsaved session changes/)).toBeNull();
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Redo" }) as HTMLButtonElement).disabled).toBe(
      false,
    );

    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    await waitFor(() => expect(readEditorText(editor)).toBe("const value = 2;"));
    expect(screen.getByText(/Unsaved session changes/)).toBeTruthy();

    fireEvent.keyDown(editor, { key: "z", ctrlKey: true });
    await waitFor(() => expect(readEditorText(editor)).toBe(original));
    fireEvent.keyDown(editor, { key: "y", ctrlKey: true });
    await waitFor(() => expect(readEditorText(editor)).toBe("const value = 2;"));

    fireEvent.click(await screen.findByText("other.ts"));
    const otherEditor = await screen.findByRole("textbox", { name: "Editor content other.ts" });
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(true);
    await enterEditorText(otherEditor, "const other = 1;");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(readEditorText(otherEditor)).toBe("const other = 0;"));
    fireEvent.click(screen.getByRole("tab", { name: /history\.ts/ }));
    const restoredEditor = await screen.findByRole("textbox", {
      name: "Editor content history.ts",
    });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(readEditorText(restoredEditor)).toBe(original));
  });

  test("asks before discarding unsaved editor changes when closing a tab", async () => {
    render(<App />);
    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
        "button",
        { name: "Open workspace" },
      ),
    );
    selectWorkspaceFiles();
    expandTreeFolder("src");
    fireEvent.click(await screen.findByText("App.tsx"));
    await enterEditorText(
      await screen.findByRole("textbox", { name: "Editor content src/App.tsx" }),
      "unsaved",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Close App.tsx" }));
    expect(await screen.findByText(/changes in src\/App\.tsx have not been saved/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    fireEvent.click(screen.getByRole("tab", { name: /App\.tsx/ }));
    expect(screen.getByRole("textbox", { name: "Editor content src/App.tsx" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Close App.tsx" }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard changes" }));
    expect(screen.queryByRole("tab", { name: /App\.tsx/ })).toBeNull();

    fireEvent.click(await screen.findByText("App.tsx"));
    const reopenedEditor = await screen.findByRole("textbox", {
      name: "Editor content src/App.tsx",
    });
    await waitFor(() => expect(readEditorText(reopenedEditor)).toContain("function App()"));
    expect(readEditorText(reopenedEditor)).not.toBe("unsaved");
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("saves editor changes through the scoped desktop workspace API", async () => {
    const priorApi = window.loomDesktop;
    const writeFile = mock(async () => ({ written: true }));
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list: async () => [{ name: "main.ts", path: "main.ts", isDir: false, size: 13 }],
        gitStatus: async () => ({ isGit: false, branch: "" }),
        readFile: async () => ({ content: "export const ready = false;" }),
        writeFile,
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };

    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      fireEvent.click(await screen.findByText("main.ts"));

      const editor = await screen.findByRole("textbox", { name: "Editor content main.ts" });
      await enterEditorText(editor, "export const ready = true;");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        await Promise.resolve();
      });

      expect(writeFile).toHaveBeenCalledWith("main.ts", "export const ready = true;");
      expect(screen.queryByLabelText("Unsaved changes")).toBeNull();
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("shows a failed save beside the editor and keeps the file dirty", async () => {
    const priorApi = window.loomDesktop;
    let shouldFail = true;
    const writeFile = mock(async () => {
      if (shouldFail) {
        throw new Error("Workspace is read-only.");
      }
      return { written: true };
    });
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list: async () => [{ name: "main.ts", path: "main.ts", isDir: false, size: 13 }],
        readFile: async () => ({ content: "export const ready = false;" }),
        writeFile,
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      fireEvent.click(await screen.findByText("main.ts"));
      const editor = await screen.findByRole("textbox", { name: "Editor content main.ts" });
      await enterEditorText(editor, "export const ready = true;");
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      const editorPanel = screen.getByRole("tabpanel", { name: "main.ts" });
      expect((await within(editorPanel).findByRole("alert")).textContent).toBe(
        "Workspace is read-only.",
      );
      expect(writeFile).toHaveBeenCalledWith("main.ts", "export const ready = true;");
      expect(screen.getByLabelText("Unsaved changes")).toBeTruthy();

      shouldFail = false;
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
      await waitFor(() => expect(screen.queryByLabelText("Unsaved changes")).toBeNull());
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("keeps edits made while a desktop save is in flight marked as unsaved", async () => {
    const priorApi = window.loomDesktop;
    let resolveWrite: ((value: { written: true }) => void) | undefined;
    const writeFile = mock(
      () =>
        new Promise<{ written: true }>((resolve) => {
          resolveWrite = resolve;
        }),
    );
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list: async () => [{ name: "main.ts", path: "main.ts", isDir: false, size: 13 }],
        readFile: async () => ({ content: "export const ready = false;" }),
        writeFile,
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };

    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      fireEvent.click(await screen.findByText("main.ts"));
      const editor = await screen.findByRole("textbox", { name: "Editor content main.ts" });
      await enterEditorText(editor, "export const ready = true;");
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(writeFile).toHaveBeenCalled());

      await enterEditorText(editor, "export const ready = 'newer';");
      await act(async () => {
        resolveWrite?.({ written: true });
        await Promise.resolve();
      });

      expect(screen.getByLabelText("Unsaved changes")).toBeTruthy();
      expect(editor.textContent).toBe("export const ready = 'newer';");
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("saves the active editor file with Ctrl+S", async () => {
    const priorApi = window.loomDesktop;
    const writeFile = mock(async () => ({ written: true }));
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list: async () => [{ name: "main.ts", path: "main.ts", isDir: false, size: 13 }],
        readFile: async () => ({ content: "const original = true;" }),
        writeFile,
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };
    try {
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      fireEvent.click(await screen.findByText("main.ts"));
      const editor = await screen.findByRole("textbox", { name: "Editor content main.ts" });
      await enterEditorText(editor, "const updated = true;");
      fireEvent.keyDown(window, { key: "s", ctrlKey: true });
      await waitFor(() =>
        expect(writeFile).toHaveBeenCalledWith("main.ts", "const updated = true;"),
      );
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("auto saves dirty desktop files when auto save is enabled", async () => {
    const priorApi = window.loomDesktop;
    const priorAutoSave = localStorage.getItem("loom:auto-save:v1");
    const writeFile = mock(async () => ({ written: true }));
    window.loomDesktop = {
      version: 1,
      platform: "win32",
      workspace: {
        open: async () => ({ root: "C:/project" }),
        list: async () => [{ name: "main.ts", path: "main.ts", isDir: false, size: 13 }],
        gitStatus: async () => ({ isGit: false, branch: "" }),
        readFile: async () => ({ content: "export const ready = false;" }),
        writeFile,
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
        rename: async () => ({ renamed: true }),
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "", model: "", configured: false }),
        configure: async () => ({ configured: true, model: "" }),
        stream: async () => undefined,
        cancel: async () => ({ cancelled: false }),
        respondApproval: async () => ({ accepted: true }),
      },
    };

    try {
      localStorage.setItem("loom:auto-save:v1", "true");
      render(<App />);
      fireEvent.click(
        within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
          "button",
          { name: "Open workspace" },
        ),
      );
      fireEvent.click(await screen.findByText("main.ts"));
      const editor = await screen.findByRole("textbox", { name: "Editor content main.ts" });
      await enterEditorText(editor, "export const autoSaved = true;");

      await waitFor(
        () => expect(writeFile).toHaveBeenCalledWith("main.ts", "export const autoSaved = true;"),
        { timeout: 2000 },
      );
      await waitFor(() => expect(screen.queryByLabelText("Unsaved changes")).toBeNull());
    } finally {
      window.loomDesktop = priorApi;
      if (priorAutoSave === null) {
        localStorage.removeItem("loom:auto-save:v1");
      } else {
        localStorage.setItem("loom:auto-save:v1", priorAutoSave);
      }
    }
  });
});
