import { test, expect, describe, mock } from "bun:test";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";

function expandTreeFolder(name: string) {
  const title = screen.getByText(name);
  const switcher = title.closest(".ant-tree-treenode")?.querySelector(".ant-tree-switcher");
  if (!switcher) throw new Error(`Tree folder ${name} has no expand control`);
  fireEvent.click(switcher);
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
    expect(screen.getByRole("textbox", { name: "Message Loom" })).toBeTruthy();
  });

  test("shows the three main desktop regions", () => {
    render(<App />);

    expect(screen.getByRole("navigation", { name: "Conversations" })).toBeTruthy();

    expect(screen.getByRole("main", { name: "Conversation" })).toBeTruthy();

    expect(screen.getByRole("complementary", { name: "Workspace explorer" }).textContent).toContain(
      "No folder open",
    );
    expect(screen.getByRole("button", { name: "Open folder" })).toBeTruthy();
  });

  test("places File Edit View and Help menus above all three workbench columns", () => {
    render(<App />);
    const menuBar = screen.getByRole("navigation", { name: "Application menu" });
    for (const name of ["File", "Edit", "View", "Help"]) {
      expect(menuBar.querySelector(`button[aria-label="${name}"]`)).toBeTruthy();
    }
    expect(menuBar.nextElementSibling?.classList.contains("app-splitter")).toBe(true);
  });

  test("adds a sent prompt to the conversation", () => {
    render(<App />);

    const composer = screen.getByRole("textbox", { name: "Message Loom" });
    fireEvent.change(composer, { target: { value: "Review this codebase" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(screen.getByRole("log").textContent).toContain("Review this codebase");
    expect((composer as HTMLTextAreaElement).value).toBe("");
  });

  test("does not create another empty chat and allows deleting a chat", async () => {
    localStorage.setItem("loom:left-panel-open:v1", "true");
    render(<App />);
    fireEvent.click(screen.getByText("New chat").closest("button")!);
    expect(
      screen.getByRole("navigation", { name: "Conversations" }).querySelectorAll("[aria-current]"),
    ).toHaveLength(1);

    fireEvent.change(screen.getByRole("textbox", { name: "Message Loom" }), {
      target: { value: "Keep this conversation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.click(screen.getByText("New chat").closest("button")!);
    fireEvent.click(screen.getByRole("button", { name: "Delete chat Keep this conversation" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete chat", exact: true }));

    expect(screen.queryByRole("button", { name: /Keep this conversation/ })).toBeNull();
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

  test("stops an active run and preserves the partial assistant response", async () => {
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
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "http://local/v1", model: "test", configured: true }),
        configure: async () => ({ configured: true, model: "test" }),
        stream: mock(
          async (
            _runId: string,
            _request: unknown,
            onUpdate: (event: { content?: string }) => void,
          ) => {
            onUpdate({ content: "Partial answer" });
            await new Promise<void>((resolve) => {
              finishStream = resolve;
            });
          },
        ),
        cancel: async () => {
          finishStream?.();
          return { cancelled: true };
        },
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
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Stop run" }));
      });
      await waitFor(() => expect(screen.getByRole("log").textContent).toContain("Partial answer"));
      expect(screen.queryByRole("button", { name: "Stop run" })).toBeNull();
      expect(screen.getByRole("log").textContent).toContain("Partial answer");
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("shows a real tool approval and sends the user's decision back to the runtime", async () => {
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
      },
      agent: {
        loadConfig: async () => ({ baseUrl: "http://local/v1", model: "test", configured: true }),
        configure: async () => ({ configured: true, model: "test" }),
        stream: async (_runId, _request, onUpdate) => {
          onUpdate({
            approval: {
              id: "call-1",
              toolName: "workspace.writeFile",
              arguments: { path: "src/main.go", content: "safe" },
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
        target: { value: "Edit file" },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Send message" }));
      });
      expect(await screen.findByText("workspace.writeFile")).toBeTruthy();
      expect(screen.getByText("workspace.writeFile")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Approve once" }));
      await waitFor(() => expect(respondApproval).toHaveBeenCalledWith("call-1", true));
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
    expect(screen.getByRole("complementary", { name: "Workspace tools" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open folder" })).toBeTruthy();
    expect(screen.getByRole("main", { name: "Conversation" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Show workspace explorer" }));
    expect(screen.getByRole("complementary", { name: "Workspace explorer" })).toBeTruthy();
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

    fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
    selectWorkspaceFiles();
    fireEvent.click(screen.getByRole("button", { name: "Hide workspace explorer" }));

    const tools = screen.getByRole("complementary", { name: "Workspace tools" });
    expect(screen.getByRole("button", { name: "Show workspace explorer" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open another folder" })).toBeTruthy();
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
      fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
      await screen.findByText("new.ts");
      fireEvent.click(screen.getByRole("button", { name: "Refresh workspace files" }));
      await waitFor(() => expect(list).toHaveBeenCalledWith("."));
    } finally {
      window.loomDesktop = priorApi;
    }
  });

  test("opens the folder chooser directly without a sample workspace dialog", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
    const folderInput = screen.getByLabelText("Workspace folder input");
    expect(folderInput).toBeTruthy();
    expect(screen.queryByText(/Select a project folder/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Open sample" })).toBeNull();
    selectWorkspaceFiles();

    const explorer = screen.getByRole("complementary", { name: "Workspace explorer" });
    expect(explorer.textContent).toContain("sample-project");
    expect(explorer.textContent).toContain("src");
    expect(screen.queryByText("App.tsx")).toBeNull();
    expect(screen.queryByText("No folder open")).toBeNull();
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
      fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
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
      fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
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
      fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
      await screen.findByText("notes.txt");
      fireEvent.contextMenu(screen.getByText("notes.txt"));
      fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
      fireEvent.click(await screen.findByRole("button", { name: "Delete", exact: true }));
      await waitFor(() => expect(remove).toHaveBeenCalledWith("notes.txt"));
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
      fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
      const sourceFolder = await screen.findByText("src");
      expect(list).not.toHaveBeenCalledWith("src");
      const switcher = sourceFolder
        .closest(".ant-tree-treenode")
        ?.querySelector(".ant-tree-switcher");
      if (!switcher) {
        throw new Error("source folder expand control was not found");
      }
      fireEvent.click(switcher);

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
    fireEvent.click(screen.getByRole("button", { name: "message First conversation" }));

    expect(screen.getByRole("log").textContent).toContain("First conversation");
    expect(screen.getByRole("log").textContent?.includes("Second conversation")).toBe(false);
  });

  test("filters recent conversations by the search query", () => {
    render(<App />);

    fireEvent.change(screen.getByRole("textbox", { name: "Search conversations" }), {
      target: { value: "missing" },
    });

    expect(screen.queryByRole("button", { name: /Welcome to Loom/ })).toBeNull();
  });

  test("opens gateway settings from the sidebar", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));

    expect(screen.getByText("Signed-in account")).toBeTruthy();
    expect(screen.getByText("demo@loom.local")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Gateway" }));
    expect(screen.getByText("Gateway connection")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect provider" })).toBeTruthy();
  });

  test("opens a preview for a workspace file", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
    selectWorkspaceFiles();
    expandTreeFolder("src");
    fireEvent.click(await screen.findByText("App.tsx"));

    expect(await screen.findByRole("tab", { name: /App.tsx/ })).toBeTruthy();
    expect(
      (screen.getByRole("textbox", { name: "Editor content src/App.tsx" }) as HTMLTextAreaElement)
        .value,
    ).toContain("Hello, Loom");
    expect(screen.getByLabelText("Editor line numbers").textContent).toBe("123");
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

    fireEvent.click(screen.getByRole("button", { name: "message Inspect a file" }));
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
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Approval mode" }));
    fireEvent.click(await screen.findByText("Approve for me"));
    const composer = screen.getByRole("textbox", { name: "Message Loom" });
    fireEvent.change(composer, { target: { value: "Change the welcome title" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview tool approval" }));

    expect(screen.queryByRole("button", { name: "Approve once" }) === null).toBe(true);
    expect(screen.queryByText("Proposed edit · src/App.tsx") !== null).toBe(true);
  });

  test("full-access mode accepts the local preview change immediately", async () => {
    render(<App />);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Approval mode" }));
    fireEvent.click(await screen.findByText("Full access"));
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

  test("places model, reasoning, approval, and extension controls below the composer", () => {
    render(<App />);

    for (const name of ["Model", "Reasoning effort", "Approval mode"]) {
      expect(screen.getByRole("combobox", { name }).closest(".composer-options")).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "Add plugin or MCP" })).toBeTruthy();
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
    fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
    const file = new File(["export const answer = 42;"], "answer.ts", { type: "text/plain" });
    Object.defineProperty(file, "webkitRelativePath", {
      value: "sample-project/src/answer.ts",
    });
    Object.defineProperty(file, "text", { value: async () => "export const answer = 42;" });
    fireEvent.change(screen.getByLabelText("Workspace folder input"), {
      target: { files: [file] },
    });
    expandTreeFolder("src");
    expandTreeFolder("src");
    fireEvent.click(await screen.findByText("answer.ts"));

    expect(await screen.findByRole("tabpanel", { name: "src/answer.ts" })).toBeTruthy();
    expect(screen.getByRole("tabpanel", { name: "src/answer.ts" }).textContent).toContain("42");
  });

  test("renders line numbers for the active code editor", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
    const file = new File(["const first = 1;\nconst second = 2;"], "lines.ts", {
      type: "text/plain",
    });
    Object.defineProperty(file, "webkitRelativePath", { value: "lines-project/lines.ts" });
    fireEvent.change(screen.getByLabelText("Workspace folder input"), {
      target: { files: [file] },
    });
    fireEvent.click(await screen.findByText("lines.ts"));

    const lineNumbers = await screen.findByLabelText("Editor line numbers");
    expect(lineNumbers.textContent).toBe("12");
    expect(lineNumbers.children.length).toBe(2);
    expect(lineNumbers.children[0].textContent).toBe("1");
    expect(lineNumbers.children[1].textContent).toBe("2");
    expect(lineNumbers.closest(".code-editor-scroll")).toBeTruthy();
  });

  test("opens large local text files without an arbitrary preview size cap", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
    const content = `const source = "${"x".repeat(1_100_000)}";`;
    const file = new File([content], "large.ts", { type: "text/plain" });
    Object.defineProperty(file, "webkitRelativePath", { value: "large-project/src/large.ts" });
    Object.defineProperty(file, "text", { value: async () => content });
    fireEvent.change(screen.getByLabelText("Workspace folder input"), {
      target: { files: [file] },
    });
    expandTreeFolder("src");
    fireEvent.click(await screen.findByText("large.ts"));

    const editor = (await screen.findByRole("textbox", {
      name: "Editor content src/large.ts",
    })) as HTMLTextAreaElement;
    expect(editor.value).toBe(content);
  });

  test("shows a clear message when a local file exceeds the 50 MiB editor limit", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
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

    fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
    selectWorkspaceFiles();

    const explorer = screen.getByRole("complementary", { name: "Workspace explorer" });
    expect(explorer.textContent).toContain("sample-project");
    expect(screen.queryByText("App.tsx")).toBeNull();
    expandTreeFolder("src");
    expect(explorer.textContent).toContain("App.tsx");
    fireEvent.click(screen.getByText("App.tsx"));

    expect(await screen.findByRole("tabpanel", { name: "src/App.tsx" })).toBeTruthy();
    expect(screen.getByRole("tabpanel", { name: "src/App.tsx" }).textContent).toContain(
      "function App()",
    );
    expect(screen.getByRole("tablist", { name: "Open views" }).textContent).toContain("Chat");
  });

  test("edits an open file and keeps its session changes when switching tabs", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
    selectWorkspaceFiles();
    expandTreeFolder("src");
    fireEvent.click(await screen.findByText("App.tsx"));

    const editor = await screen.findByRole("textbox", { name: "Editor content src/App.tsx" });
    fireEvent.change(editor, { target: { value: "export const changed = true;" } });

    expect((editor as HTMLTextAreaElement).value).toBe("export const changed = true;");
    expect(screen.getByRole("status").textContent).toContain("Unsaved session changes");

    fireEvent.click(
      screen.getByRole("tablist", { name: "Open views" }).querySelector('[role="tab"]')!,
    );
    fireEvent.click(screen.getByRole("tab", { name: /App\.tsx/ }));

    expect(
      (screen.getByRole("textbox", { name: "Editor content src/App.tsx" }) as HTMLTextAreaElement)
        .value,
    ).toBe("export const changed = true;");
  });

  test("asks before discarding unsaved editor changes when closing a tab", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
    selectWorkspaceFiles();
    expandTreeFolder("src");
    fireEvent.click(await screen.findByText("App.tsx"));
    fireEvent.change(await screen.findByRole("textbox", { name: "Editor content src/App.tsx" }), {
      target: { value: "unsaved" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Close App.tsx" }));
    expect(await screen.findByText(/changes in src\/App\.tsx have not been saved/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("textbox", { name: "Editor content src/App.tsx" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close App.tsx" }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard changes" }));
    expect(screen.queryByRole("tab", { name: /App\.tsx/ })).toBeNull();
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
        readFile: async () => ({ content: "export const ready = false;" }),
        writeFile,
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
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
      fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
      fireEvent.click(await screen.findByText("main.ts"));

      const editor = await screen.findByRole("textbox", { name: "Editor content main.ts" });
      fireEvent.change(editor, { target: { value: "export const ready = true;" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(writeFile).toHaveBeenCalledWith("main.ts", "export const ready = true;");
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
      fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
      fireEvent.click(await screen.findByText("main.ts"));
      const editor = await screen.findByRole("textbox", { name: "Editor content main.ts" });
      fireEvent.change(editor, { target: { value: "export const ready = true;" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(writeFile).toHaveBeenCalled());

      fireEvent.change(editor, { target: { value: "export const ready = 'newer';" } });
      await act(async () => {
        resolveWrite?.({ written: true });
        await Promise.resolve();
      });

      expect(screen.getByLabelText("Unsaved changes")).toBeTruthy();
      expect((editor as HTMLTextAreaElement).value).toBe("export const ready = 'newer';");
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
      fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
      fireEvent.click(await screen.findByText("main.ts"));
      const editor = await screen.findByRole("textbox", { name: "Editor content main.ts" });
      fireEvent.change(editor, { target: { value: "const updated = true;" } });
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
        readFile: async () => ({ content: "export const ready = false;" }),
        writeFile,
        createFile: async () => ({ created: true }),
        createDirectory: async () => ({ created: true }),
        delete: async () => ({ deleted: true }),
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
      fireEvent.click(screen.getByRole("button", { name: "File" }));
      fireEvent.click(screen.getByRole("switch"));
      fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
      fireEvent.click(await screen.findByText("main.ts"));
      const editor = await screen.findByRole("textbox", { name: "Editor content main.ts" });
      fireEvent.change(editor, {
        target: { value: "export const autoSaved = true;" },
      });

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
