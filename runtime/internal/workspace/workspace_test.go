package workspace

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestCreateRootCreatesNamedWorkspaceUnderSelectedParent(t *testing.T) {
	parent := t.TempDir()
	created, err := CreateRoot(parent, "my-workspace")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = created.Close() })

	want := filepath.Join(parent, "my-workspace")
	if created.Name() != want {
		t.Fatalf("unexpected workspace root: got %q, want %q", created.Name(), want)
	}
	info, err := os.Stat(want)
	if err != nil {
		t.Fatal(err)
	}
	if !info.IsDir() {
		t.Fatalf("created workspace is not a directory: %q", want)
	}
}

func TestCreateRootRejectsInvalidNamesAndExistingDirectories(t *testing.T) {
	parent := t.TempDir()
	if err := os.Mkdir(filepath.Join(parent, "existing"), 0o700); err != nil {
		t.Fatal(err)
	}

	for _, name := range []string{"", ".", "..", "../outside", `nested\\workspace`, "/absolute", "bad:name", "bad*name", "CON", "LPT1.log", "trailing."} {
		if _, err := CreateRoot(parent, name); !errors.Is(err, ErrInvalidPath) {
			t.Errorf("CreateRoot(%q) error = %v, want %v", name, err, ErrInvalidPath)
		}
	}
	if _, err := CreateRoot(parent, "existing"); !errors.Is(err, ErrPathExists) {
		t.Fatalf("existing destination error = %v, want %v", err, ErrPathExists)
	}
	if _, err := os.Stat(filepath.Join(parent, "outside")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("invalid name created an outside directory: %v", err)
	}
}

func TestWorkspaceListsReadsAndWritesFilesWithinItsRoot(t *testing.T) {
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
	t.Cleanup(func() { _ = workspace.Close() })

	entries, err := workspace.List("src")
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || entries[0].Name != "main.go" || entries[0].Path != "src/main.go" {
		t.Fatalf("unexpected entries: %#v", entries)
	}

	content, err := workspace.ReadFile("src/main.go")
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "package main" {
		t.Fatalf("unexpected file content: %q", content)
	}

	if err := workspace.WriteFile("src/main.go", []byte("package main\n\nfunc main() {}")); err != nil {
		t.Fatal(err)
	}
	content, err = os.ReadFile(filepath.Join(root, "src", "main.go"))
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "package main\n\nfunc main() {}" {
		t.Fatalf("write did not update workspace file: %q", content)
	}
}

func TestWorkspaceGitStatusReadsBranchAndIgnoresWorktreePointerTargets(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, ".git", "refs", "heads"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, ".git", "HEAD"), []byte("ref: refs/heads/feature/chat-ui\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	workspace, err := Open(root)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = workspace.Close() })
	isGit, branch, err := workspace.GitStatus()
	if err != nil || !isGit || branch != "feature/chat-ui" {
		t.Fatalf("GitStatus()=(%v,%q,%v)", isGit, branch, err)
	}

	if err := os.RemoveAll(filepath.Join(root, ".git")); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, ".git"), []byte("gitdir: ../outside/worktrees/demo\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	isGit, branch, err = workspace.GitStatus()
	if err != nil || !isGit || branch != "" {
		t.Fatalf("worktree GitStatus()=(%v,%q,%v), expected branch unavailable without escaping root", isGit, branch, err)
	}
}

func TestWorkspaceCreatesNewFileWithoutReplacingExistingContent(t *testing.T) {
	root := t.TempDir()
	if err := os.Mkdir(filepath.Join(root, "src"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "src", "existing.go"), []byte("keep"), 0o600); err != nil {
		t.Fatal(err)
	}
	workspace, err := Open(root)
	if err != nil {
		t.Fatal(err)
	}
	defer workspace.Close()

	if err := workspace.CreateFile("src/new.go"); err != nil {
		t.Fatal(err)
	}
	created, err := os.ReadFile(filepath.Join(root, "src", "new.go"))
	if err != nil || len(created) != 0 {
		t.Fatalf("created file content=%q err=%v", created, err)
	}
	if err := workspace.CreateFile("src/existing.go"); !errors.Is(err, os.ErrExist) {
		t.Fatalf("existing file create error=%v, want already-exists", err)
	}
	existing, err := os.ReadFile(filepath.Join(root, "src", "existing.go"))
	if err != nil || string(existing) != "keep" {
		t.Fatalf("existing file content=%q err=%v", existing, err)
	}
}

func TestWorkspaceCreatesAndDeletesFilesAndDirectoriesWithinRoot(t *testing.T) {
	root := t.TempDir()
	workspace, err := Open(root)
	if err != nil {
		t.Fatal(err)
	}
	defer workspace.Close()

	if err := workspace.CreateDirectory("src/components"); err != nil {
		t.Fatal(err)
	}
	if err := workspace.CreateFile("src/components/App.tsx"); err != nil {
		t.Fatal(err)
	}
	if err := workspace.CreateFile("src/components/Nested.tsx"); err != nil {
		t.Fatal(err)
	}
	if err := workspace.Delete("src/components/App.tsx"); err != nil {
		t.Fatal(err)
	}
	if err := workspace.Delete("src/components"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, "src", "components")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("deleted directory stat error=%v, want not-exist", err)
	}
}

func TestWorkspaceDeleteRejectsWorkspaceRootAndTraversal(t *testing.T) {
	root := t.TempDir()
	workspace, err := Open(root)
	if err != nil {
		t.Fatal(err)
	}
	defer workspace.Close()
	for _, target := range []string{".", "../outside"} {
		if err := workspace.Delete(target); err == nil {
			t.Fatalf("delete %q unexpectedly succeeded", target)
		}
	}
}

func TestWorkspaceRejectsPathsOutsideRoot(t *testing.T) {
	root := t.TempDir()
	outside := filepath.Join(t.TempDir(), "secret.txt")
	if err := os.WriteFile(outside, []byte("secret"), 0o600); err != nil {
		t.Fatal(err)
	}

	workspace, err := Open(root)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = workspace.Close() })

	if _, err := workspace.ReadFile("../" + filepath.Base(filepath.Dir(outside)) + "/secret.txt"); err == nil {
		t.Fatal("expected path traversal read to fail")
	}
	if err := workspace.WriteFile("../outside.txt", []byte("bad")); err == nil {
		t.Fatal("expected path traversal write to fail")
	}
	if err := workspace.CreateFile("../outside.txt"); err == nil {
		t.Fatal("expected path traversal create to fail")
	}
	content, err := os.ReadFile(outside)
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "secret" {
		t.Fatalf("outside file was modified: %q", content)
	}
}

func TestWorkspaceRejectsInvalidAndOversizedFileOperations(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "large.txt"), make([]byte, maxFileSize+1), 0o600); err != nil {
		t.Fatal(err)
	}
	workspace, err := Open(root)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = workspace.Close() })

	if _, err := workspace.ReadFile("large.txt"); err == nil {
		t.Fatal("expected oversized read to fail")
	}
	if err := workspace.WriteFile("large.txt", make([]byte, maxFileSize+1)); err == nil {
		t.Fatal("expected oversized write to fail")
	}
	if _, err := workspace.ReadFile("../large.txt"); err == nil {
		t.Fatal("expected invalid path to fail")
	}
}

func TestWorkspaceReadsAndWritesFilesLargerThanOneMiB(t *testing.T) {
	root := t.TempDir()
	workspace, err := Open(root)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = workspace.Close() })

	content := bytes.Repeat([]byte("x"), (2<<20)+1)
	if err := os.WriteFile(filepath.Join(root, "large.txt"), content, 0o600); err != nil {
		t.Fatal(err)
	}
	read, err := workspace.ReadFile("large.txt")
	if err != nil {
		t.Fatalf("read 2 MiB text file: %v", err)
	}
	if !bytes.Equal(read, content) {
		t.Fatal("large file read was truncated")
	}

	if err := workspace.WriteFile("large.txt", content); err != nil {
		t.Fatalf("write 2 MiB text file: %v", err)
	}
}

func TestWorkspaceRejectsSymlinksOutsideRoot(t *testing.T) {
	root := t.TempDir()
	outside := filepath.Join(t.TempDir(), "secret.txt")
	if err := os.WriteFile(outside, []byte("secret"), 0o600); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(root, "escape.txt")
	if err := os.Symlink(outside, link); err != nil {
		t.Skipf("symlink creation is unavailable: %v", err)
	}

	workspace, err := Open(root)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = workspace.Close() })
	if _, err := workspace.ReadFile("escape.txt"); err == nil {
		t.Fatal("expected outside symlink read to fail")
	}
	if err := workspace.WriteFile("escape.txt", []byte("bad")); err == nil {
		t.Fatal("expected outside symlink write to fail")
	}
	if err := workspace.Delete("escape.txt"); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(outside)
	if err != nil || string(content) != "secret" {
		t.Fatalf("deleting workspace symlink changed its target: content=%q err=%v", content, err)
	}
}
