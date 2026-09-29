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

func (workspace *Workspace) Close() error {
	return workspace.root.Close()
}

func (workspace *Workspace) Name() string {
	return workspace.root.Name()
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

func normalizePath(relativePath string) (string, error) {
	if relativePath == "" {
		return ".", nil
	}
	if strings.Contains(relativePath, `\`) || !fs.ValidPath(relativePath) {
		return "", ErrInvalidPath
	}
	return filepath.FromSlash(relativePath), nil
}
