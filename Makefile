.PHONY: install dev test runtime-test build package-win package-mac icon

install:
	bun install

dev:
	bun run dev:desktop

test:
	bun test

runtime-test:
	go -C runtime test ./...

icon:
	go -C runtime run ./cmd/loom-icon ../apps/desktop/public/loom-avatar.png ../apps/desktop/build-resources

build:
	bun run build

package-win:
	bun run --cwd apps/desktop package:win

package-mac:
	bun run --cwd apps/desktop package:mac
