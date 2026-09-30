package workspace

import (
	"errors"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"
)

const maxFileSize = 50 << 20

var (
	ErrInvalidPath  = errors.New("workspace path must be relative to the selected root")
	ErrFileTooLarge = errors.New("workspace file exceeds the 50 MiB editor limit")
	ErrNotRegular   = errors.New("workspace operation requires a regular file")
	ErrPathExists   = errors.New("workspace destination already exists")
)

type Entry struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	IsDir bool   `json:"isDir"`
	Size  int64  `json:"size"`
}

// Workspace scopes every operation to the directory explicitly opened by the user.
type Workspace struct {
	root *os.Root
}

func Open(directory string) (*Workspace, error) {
	if strings.TrimSpace(directory) == "" {
		return nil, ErrInvalidPath
	}

	absoluteDirectory, err := filepath.Abs(directory)
	if err != nil {
		return nil, err
	}
	root, err := os.OpenRoot(absoluteDirectory)
	if err != nil {
		return nil, err
	}
	return &Workspace{root: root}, nil
}

func CreateRoot(parentDirectory, name string) (*Workspace, error) {
	if strings.TrimSpace(parentDirectory) == "" || name == "" || name == "." || name == ".." ||
		strings.ContainsAny(name, `<>:"/\\|?*`) || strings.HasSuffix(name, ".") ||
		strings.HasSuffix(name, " ") || !fs.ValidPath(name) || isReservedWorkspaceName(name) {
		return nil, ErrInvalidPath
	}

	absoluteParent, err := filepath.Abs(parentDirectory)
	if err != nil {
		return nil, err
	}
	parent, err := os.OpenRoot(absoluteParent)
	if err != nil {
		return nil, err
	}
	defer parent.Close()

	if err := parent.Mkdir(name, 0o700); err != nil {
		if errors.Is(err, fs.ErrExist) {
			return nil, ErrPathExists
		}
		return nil, err
	}
	root, err := parent.OpenRoot(name)
	if err != nil {
		_ = parent.Remove(name)
		return nil, err
	}
	return &Workspace{root: root}, nil
}

func isReservedWorkspaceName(name string) bool {
	base := strings.ToUpper(strings.SplitN(name, ".", 2)[0])
	if base == "CON" || base == "PRN" || base == "AUX" || base == "NUL" {
		return true
	}
	if len(base) == 4 && (strings.HasPrefix(base, "COM") || strings.HasPrefix(base, "LPT")) {
		return base[3] >= '1' && base[3] <= '9'
	}
	return false
}

func (workspace *Workspace) Close() error {
	return workspace.root.Close()
}

func (workspace *Workspace) Name() string {
	return workspace.root.Name()
}

func (workspace *Workspace) GitStatus() (bool, string, error) {
	gitDirectory, err := workspace.root.Open(".git")
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return false, "", nil
		}
		return false, "", err
	}
	info, err := gitDirectory.Stat()
	if err != nil {
		_ = gitDirectory.Close()
		return false, "", err
	}
	if !info.IsDir() {
		_ = gitDirectory.Close()
		// A worktree's .git entry is a file containing a gitdir pointer that commonly
		// points outside the selected root. Do not follow that pointer across the grant.
		content, readErr := workspace.ReadFile(".git")
		if readErr != nil {
			return true, "", nil
		}
		pointer := strings.TrimSpace(string(content))
		if !strings.HasPrefix(pointer, "gitdir: ") {
			return true, "", nil
		}
		return true, "", nil
	}
	_ = gitDirectory.Close()
	head, err := workspace.ReadFile(".git/HEAD")
	if err != nil {
		return true, "", nil
	}
	return true, branchFromHead(string(head)), nil
}

func branchFromHead(head string) string {
	head = strings.TrimSpace(head)
	const branchPrefix = "ref: refs/heads/"
	if strings.HasPrefix(head, branchPrefix) {
		return strings.TrimPrefix(head, branchPrefix)
	}
	return ""
}

func (workspace *Workspace) List(relativePath string) ([]Entry, error) {
	name, err := normalizePath(relativePath)
	if err != nil {
		return nil, err
	}
	directory, err := workspace.root.Open(name)
	if err != nil {
		return nil, err
	}
	defer directory.Close()
	children, err := directory.ReadDir(-1)
	if err != nil {
		return nil, err
	}

	entries := make([]Entry, 0, len(children))
	for _, child := range children {
		info, err := child.Info()
		if err != nil {
			return nil, err
		}

		childPath := child.Name()
		if name != "." {
			childPath = path.Join(name, childPath)
		}
		entries = append(entries, Entry{
			Name:  child.Name(),
			Path:  childPath,
			IsDir: info.IsDir(),
			Size:  info.Size(),
		})
	}
	return entries, nil
}

func (workspace *Workspace) ReadFile(relativePath string) ([]byte, error) {
	name, err := normalizePath(relativePath)
	if err != nil || name == "." {
		return nil, ErrInvalidPath
	}

	file, err := workspace.root.Open(name)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() {
		return nil, ErrNotRegular
	}
	if info.Size() > maxFileSize {
		return nil, ErrFileTooLarge
	}

	content, err := io.ReadAll(io.LimitReader(file, maxFileSize+1))
	if err != nil {
		return nil, err
	}
	if len(content) > maxFileSize {
		return nil, ErrFileTooLarge
	}
	return content, nil
}

func (workspace *Workspace) WriteFile(relativePath string, content []byte) error {
	name, err := normalizePath(relativePath)
	if err != nil || name == "." {
		return ErrInvalidPath
	}
	if len(content) > maxFileSize {
		return ErrFileTooLarge
	}

	file, err := workspace.root.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() {
		return ErrNotRegular
	}

	written, err := file.Write(content)
	if err != nil {
		return err
	}
	if written != len(content) {
		return io.ErrShortWrite
	}
	return nil
}

func (workspace *Workspace) CreateFile(relativePath string) error {
	name, err := normalizePath(relativePath)
	if err != nil || name == "." {
		return ErrInvalidPath
	}
	file, err := workspace.root.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return err
	}
	return file.Close()
}

func (workspace *Workspace) CreateDirectory(relativePath string) error {
	name, err := normalizePath(relativePath)
	if err != nil || name == "." {
		return ErrInvalidPath
	}
	return workspace.root.MkdirAll(name, 0o700)
}

func (workspace *Workspace) Delete(relativePath string) error {
	name, err := normalizePath(relativePath)
	if err != nil || name == "." {
		return ErrInvalidPath
	}
	return workspace.root.RemoveAll(name)
}

func (workspace *Workspace) Rename(oldRelativePath, newRelativePath string) error {
	oldName, err := normalizePath(oldRelativePath)
	if err != nil || oldName == "." {
		return ErrInvalidPath
	}
	newName, err := normalizePath(newRelativePath)
	if err != nil || newName == "." || oldName == newName {
		return ErrInvalidPath
	}

	sourceInfo, err := workspace.root.Lstat(oldName)
	if err != nil {
		return err
	}
	if _, err := workspace.root.Lstat(newName); err == nil {
		return ErrPathExists
	} else if !errors.Is(err, fs.ErrNotExist) {
		return err
	}
	if sourceInfo.IsDir() {
		relative, err := filepath.Rel(oldName, newName)
		if err != nil {
			return err
		}
		separator := string(filepath.Separator)
		if relative == "." || (relative != ".." && !strings.HasPrefix(relative, ".."+separator)) {
			return ErrInvalidPath
		}
	}
	return workspace.root.Rename(oldName, newName)
}

func normalizePath(relativePath string) (string, error) {
	if relativePath == "" {
		return ".", nil
	}
	if strings.Contains(relativePath, `\`) || !fs.ValidPath(relativePath) {
		return "", ErrInvalidPath
	}
	return filepath.FromSlash(relativePath), nil
}
