import { beforeEach, test, expect, describe } from "bun:test";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import App from "./App";
import { WorkspaceExplorer, type WorkspaceTreeNode } from "./components/WorkspaceExplorer";

beforeEach(() => {
  localStorage.setItem("loom:right-panel-open:v1", "true");
});

function selectWorkspaceFiles() {
  const files = [
    new File(["function App() {\n  return <main>Hello, Loom</main>;\n}"], "App.tsx"),
    new File(["createRoot(root).render(<App />);"], "main.tsx"),
    new File(["# loom-demo\n\nA sample coding workspace."], "README.md"),
  ];
  for (const file of files) {
    Object.defineProperty(file, "webkitRelativePath", {
      value: `sample-project/${file.name === "README.md" ? "" : "src/"}${file.name}`,
    });
  }
  fireEvent.change(screen.getByLabelText("Workspace folder input"), { target: { files } });
}

function expandTreeFolder(name: string) {
  fireEvent.click(screen.getByRole("button", { name: `Expand ${name}` }));
}

const explorerTree: WorkspaceTreeNode[] = [
  { key: "src", title: "src", children: [], isLeaf: false },
];

function SwitchingExplorer({
  onLoadDirectory,
}: {
  onLoadDirectory(path: string): Promise<never[]>;
}) {
  const [workspaceRoot, setWorkspaceRoot] = useState("C:/old-project");
  return (
    <>
      <button type="button" onClick={() => setWorkspaceRoot("C:/new-project")}>
        Switch workspace
      </button>
      <WorkspaceExplorer
        open
        workspaceRoot={workspaceRoot}
        gatewayConnected={false}
        workspaceError={null}
        treeData={explorerTree}
        workspaceFiles={[]}
        activeFilePath={null}
        workspaceSearchFiles={null}
        workspaceSearchLoading={false}
        onSearchWorkspace={() => undefined}
        onOpenFolder={() => undefined}
        onRefresh={() => undefined}
        onCreateFile={() => undefined}
        onCreateDirectory={() => undefined}
        onDelete={() => undefined}
        onRename={() => undefined}
        onOpenFile={() => undefined}
        onCollapse={() => undefined}
        onExpand={() => undefined}
        onLoadDirectory={onLoadDirectory}
      />
    </>
  );
}

describe("Workspace switching", () => {
  test("resets expanded explorer folders when opening a different workspace", async () => {
    render(<App />);
    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Workspace explorer" })).getByRole(
        "button",
        { name: "Open workspace" },
      ),
    );
    selectWorkspaceFiles();
    expandTreeFolder("src");
    expect(await screen.findByText("App.tsx")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open another workspace" }));
    const files = [new File(["export const other = true;"], "other.ts")];
    Object.defineProperty(files[0], "webkitRelativePath", {
      value: "other-project/src/other.ts",
    });
    fireEvent.change(screen.getByLabelText("Workspace folder input"), { target: { files } });

    expect(screen.queryByText("App.tsx")).toBeNull();
    expect(screen.getByRole("button", { name: "Expand src" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Expand src" }));
    expect(await screen.findByText("other.ts")).toBeTruthy();
  });

  test("late folder loads from the previous root do not leave the new tree loading", async () => {
    let resolveOldDirectory!: (entries: never[]) => void;
    const onLoadDirectory = (path: string) =>
      path === "src"
        ? new Promise<never[]>((resolve) => {
            resolveOldDirectory = resolve;
          })
        : Promise.resolve([]);
    render(<SwitchingExplorer onLoadDirectory={onLoadDirectory} />);

    fireEvent.click(screen.getByRole("button", { name: "Expand src" }));
    fireEvent.click(screen.getByRole("button", { name: "Switch workspace" }));
    await act(async () => {
      resolveOldDirectory([]);
    });

    fireEvent.click(screen.getByRole("button", { name: "Expand src" }));
    expect(screen.getByText("Loading…")).toBeTruthy();
  });

  test("opening another workspace clears tabs that belonged to the previous root", async () => {
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
    expect(await screen.findByRole("tabpanel", { name: "src/App.tsx" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open another workspace" }));
    selectWorkspaceFiles();

    expect(screen.queryByRole("tab", { name: /App.tsx/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Chat/ })).toBeNull();
    expect(screen.getByRole("tabpanel", { name: "Chat" })).toBeTruthy();
  });
});
