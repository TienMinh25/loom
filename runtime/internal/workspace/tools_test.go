package workspace

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestWorkspaceToolExecutorScopesReadWriteAndListToOpenedRoot(t *testing.T) {
	root := t.TempDir()
	if err := os.Mkdir(filepath.Join(root, "src"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "src", "main.go"), []byte("package main"), 0o600); err != nil {
		t.Fatal(err)
	}
	workspace, err := Open(root)
	if err != nil {
		t.Fatal(err)
	}
	defer workspace.Close()
	executor := NewToolExecutor(workspace)
	read, err := executor.Execute(context.Background(), "workspace.readFile", json.RawMessage(`{"path":"src/main.go"}`))
	if err != nil || read != "package main" {
		t.Fatalf("read=%q err=%v", read, err)
	}
	listed, err := executor.Execute(context.Background(), "workspace.list", json.RawMessage(`{"path":"src"}`))
	if err != nil || !strings.Contains(listed, "src/main.go") {
		t.Fatalf("list=%s err=%v", listed, err)
	}
	if _, err := executor.Execute(context.Background(), "workspace.writeFile", json.RawMessage(`{"path":"src/main.go","content":"updated"}`)); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(filepath.Join(root, "src", "main.go"))
	if err != nil || string(content) != "updated" {
		t.Fatalf("content=%s err=%v", content, err)
	}
	if _, err := executor.Execute(context.Background(), "workspace.writeFile", json.RawMessage(`{"path":"../outside","content":"unsafe"}`)); err == nil {
		t.Fatal("expected out-of-root write to fail")
	}
}

func TestWorkspaceToolExecutorRejectsUnknownToolAndUnknownArguments(t *testing.T) {
	workspace, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer workspace.Close()
	executor := NewToolExecutor(workspace)
	if _, err := executor.Execute(context.Background(), "shell.exec", json.RawMessage(`{}`)); err == nil {
		t.Fatal("unknown tools must not execute")
	}
	if _, err := executor.Execute(context.Background(), "workspace.readFile", json.RawMessage(`{"path":"a","absolutePath":"C:/secret"}`)); err == nil {
		t.Fatal("unknown arguments must fail validation")
	}
}
