package main

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"

	"loom/runtime/internal/iconpack"
)

func main() {
	if len(os.Args) != 3 {
		fmt.Fprintln(os.Stderr, "usage: loom-icon <source.png> <output-directory>")
		os.Exit(2)
	}
	source, err := os.ReadFile(os.Args[1])
	if err != nil {
		fatal(err)
	}
	ico, err := iconpack.BuildICO(bytes.NewReader(source))
	if err != nil {
		fatal(err)
	}
	icns, err := iconpack.BuildICNS(bytes.NewReader(source))
	if err != nil {
		fatal(err)
	}
	if err := os.MkdirAll(os.Args[2], 0o755); err != nil {
		fatal(err)
	}
	if err := os.WriteFile(filepath.Join(os.Args[2], "loom.ico"), ico, 0o644); err != nil {
		fatal(err)
	}
	if err := os.WriteFile(filepath.Join(os.Args[2], "loom.icns"), icns, 0o644); err != nil {
		fatal(err)
	}
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
