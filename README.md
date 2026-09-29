# Loom

Loom is a local-first desktop coding-agent workspace. The desktop uses Electron, React, TypeScript, Ant Design, and Bun. A small Go runtime owns model requests, approval flow, and workspace-scoped filesystem operations. The initial provider boundary is OpenAI-compatible.

## Requirements

- Bun (see `package.json` for workspace scripts)
- Go 1.26.0 or newer
- Native packaging host: Windows to create the Windows installer; macOS to create the macOS DMG
- No GCC or C toolchain is required. Runtime builds set `CGO_ENABLED=0`.

## Start locally

```sh
bun install
bun run dev:desktop
```

`make dev` runs the same command when Make is installed. Browser-only UI development is available through `bun run dev`.

## Test

```sh
bun test
go -C runtime test ./...
```

Or run `make test runtime-test`.

## Build and package

```sh
bun run build
bun run --cwd apps/desktop package:win
bun run --cwd apps/desktop package:mac
```

Equivalent Make targets are `make build`, `make package-win`, and `make package-mac`. Package each target on its native operating system. Build outputs are written under `apps/desktop/dist/`, `apps/desktop/dist-electron/`, and `apps/desktop/release/`; these generated files are ignored by Git. TypeScript source is bundled by Vite/esbuild and Electron's TypeScript compiler into those output folders. No generated JavaScript is stored beside source files.

The build runs `apps/desktop/scripts/build-runtime.ts`. It creates a multi-size Windows `.ico` and macOS `.icns` from `apps/desktop/public/loom-avatar.png` using the Go-only `runtime/cmd/loom-icon` utility, then creates the native Go runtime executable. `CGO_ENABLED=0` ensures these steps do not invoke GCC or C libraries. The icons are checked in under `apps/desktop/build-resources/` and are regenerated from the PNG when packaging.

## How the desktop app runs

Electron's main process creates the window and a narrow, versioned preload API. The renderer never gets direct filesystem or process access. It asks the main process to open a native folder picker, list/read/write workspace files, or call the agent. The main process validates those requests and forwards them over versioned JSON-lines RPC.

The Go runtime starts lazily on the first operation that needs it; merely opening the window does not start it. During development, Electron starts `go run ./cmd/loom-runtime` from `runtime/`. In a packaged app it starts the bundled `loom-runtime` executable directly (`loom-runtime.exe` on Windows). The runtime uses stdin/stdout for JSON-lines requests and streaming events, and stderr for diagnostics. On app quit, Electron closes stdin so the Go runtime can shut down cleanly, then force-stops it only if it does not exit in time. A separate process keeps filesystem/model policy outside the renderer and lets the same Go code run on Windows and macOS without a C bridge.

Conversation state currently persists in browser local storage. It is not yet backed by a database or append-only transcript store. See [product storage notes](docs/product/SESSION_STORAGE.md) for the proposed durable session design and its Codex CLI reference.

## Repository structure

```text
apps/desktop/                 Electron main/preload, React UI, and desktop packaging
  electron/                   Main process, IPC bridges, and runtime supervisor
  public/                     Static renderer assets, including Loom avatar source
  scripts/                    Desktop build orchestration
  shared/                     Versioned renderer/Electron API types
  src/                        UI, workspace editor/explorer, and UI tests
runtime/                      Go 1.26 module; CGO disabled for app runtime builds
  cmd/loom-runtime/            Go agent runtime entry point
  cmd/loom-icon/               PNG to Windows ICO/macOS ICNS converter
  internal/adapter/            HTTP/SSE and OpenAI-compatible provider adapters
  internal/agent/              Normalized model/tool loop and approvals
  internal/protocol/           Versioned JSON-lines RPC DTOs and dispatch
  internal/workspace/          Filesystem operations rooted to the selected folder
  internal/iconpack/            Pure-Go native icon container generation
docs/product/                  Product baseline, architecture, UI, delivery plan, changelog
Makefile                       Cross-platform local development and packaging shortcuts
```

The authoritative product documentation lives in `docs/product/`.
