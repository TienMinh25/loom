import { test, expect, describe } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

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
  const title = screen.getByText(name);
  const switcher = title.closest(".ant-tree-treenode")?.querySelector(".ant-tree-switcher");
  if (!switcher) throw new Error(`Tree folder ${name} has no expand control`);
  fireEvent.click(switcher);
}

describe("Workspace switching", () => {
  test("opening another workspace clears tabs that belonged to the previous root", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
    selectWorkspaceFiles();
    expandTreeFolder("src");
    fireEvent.click(await screen.findByText("App.tsx"));
    expect(await screen.findByRole("tabpanel", { name: "src/App.tsx" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open another folder" }));
    selectWorkspaceFiles();

    expect(screen.queryByRole("tab", { name: /App.tsx/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Chat/ })).toBeNull();
    expect(screen.getByRole("tabpanel", { name: "Chat" })).toBeTruthy();
  });
});
