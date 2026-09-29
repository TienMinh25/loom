# Architecture — v1 baseline

**Docs version:** 1.19.0
**Status:** Draft baseline  
**Last updated:** 2026-09-29

## 1. Shape of the application

```text
┌──────────────────────── Desktop UI ─────────────────────────┐
│ Conversation · approvals · diff · right-side workspace tree  │
└───────────────────────────┬─────────────────────────────────┘
                            │ typed, validated IPC
┌───────────────────────────▼─────────────────────────────────┐
│ Local Agent Runtime                                           │
│ run/session state · policy · tool loop · event stream         │
├───────────────────┬────────────────────┬────────────────────┤
│ Provider adapter  │ Workspace executor  │ Future indexing    │
│ OpenAI-compatible │ list/read/write     │ search/symbols      │
├───────────────────┴────────────────────┴────────────────────┤
│ Plugin host / MCP clients / capability and permission checks  │
└───────────────────────────┬─────────────────────────────────┘
                            │
          SQLite + local workspace + OS credential store
```

The UI must not call model APIs or execute tools directly. It communicates with the local runtime using typed commands and subscribes to typed events. The runtime owns agent runs, policy decisions, and tool execution. Conversation data currently persists in renderer local storage; durable SQLite metadata and append-only JSONL transcripts remain a proposal in [Session storage design](SESSION_STORAGE.md).

## 2. Suggested implementation stack

V1 language split:

- **UI:** TypeScript + React, hosted in Electron and built/tested with Bun. React is the UI framework; Electron supplies the desktop window/process/native integration. Keep renderer sandboxing, context isolation, restrictive navigation, and a narrow typed preload/IPC bridge enabled.
- **Agent runtime:** Go 1.26.0, lazily started as a supervised local child process. Development runs `go run`; packaged apps run the bundled native executable. Builds set `CGO_ENABLED=0`, so no GCC/C toolchain is needed.
- **Runtime location:** the Go module lives at repository root `runtime/`, alongside `apps/`.
- **Boundary:** versioned JSON-RPC over stdio. The Electron main process owns the native directory picker and exposes a narrow, versioned IPC API to the renderer. The JSON-lines protocol supports request/response and is extended with typed streaming events, cancellation, and graceful shutdown as agent runs are implemented.

The UI keeps a typed desktop API boundary and can run in browser preview mode with deterministic local fixtures. Electron routes workspace access through the supervised Go process; renderer components do not access the filesystem directly. Workspace paths are relative to the active root and the runtime enforces that scope.

Electron + React + TypeScript + Bun is the selected v1 UI stack. Keep runtime and protocol contracts independent from the desktop framework.

### 2.3 Go runtime composition and HTTP contracts

Keep the Go runtime small and organized around concrete seams rather than mirroring a large service template:

- `cmd/loom-runtime`: composition root and process entry point.
- `internal/app`: Uber Fx dependency graph, runtime startup, and graceful shutdown hooks.
- `internal/protocol`: versioned JSON-lines request/response DTOs and dispatch.
- `internal/workspace`: filesystem operations scoped to the selected workspace, including exclusive file creation, directory creation, and contained deletion.
- `internal/adapter/httpclient`: injected `HTTPDoer`, typed JSON request/response helpers, structured HTTP errors, and generic Server-Sent Events parsing.
- `internal/adapter/provider/openai`: OpenAI-compatible Chat Completions DTOs and response mapping.
- `internal/agent`: normalized provider DTOs, registry, bounded tool loop, and approval boundary.

The shared HTTP adapter owns request construction, JSON encoding/decoding, status handling, response size limits, context cancellation, and SSE framing. Provider-specific request/response DTOs belong in the provider adapter and must not leak into the app or UI. Keep SSE events generic at this layer so provider-specific terminal markers and payloads are interpreted by their adapter. Use Uber Fx only at the composition root and for process lifecycle; application and workspace packages remain independently testable without an Fx container.

## 2.1 Testability and interface-first design

Use small Go interfaces at boundaries where implementations may vary or need isolation in tests. Avoid defining interfaces for every struct or mirroring concrete types without a demonstrated substitution seam. Core application services depend on ports, with adapters supplied at startup.

Initial ports (names illustrative):

- `ModelProvider`: stream model responses/tool proposals; the first adapter is OpenAI-compatible.
- `CredentialStore`: secure provider secret storage, with Electron OS-backed encryption at the desktop boundary.
- `Workspace`: scoped list/read/write/stat operations, with filesystem adapter.
- `CommandRunner`: structured command execution, cancellation, output, timeout, and policy context.
- `ConversationRepository`: append/read events and resume session state, with SQLite adapter.
- `ApprovalPolicy` and `ApprovalBroker`: decide allow/ask/deny and deliver requests to the UI boundary.
- `PluginCatalog` / capability interfaces: register providers, tools, and indexers through validated manifests.
- `EventPublisher`: send typed runtime events to UI and tests.

Keep domain and orchestration logic independent from Electron, SQLite, filesystem globals, network clients, and provider SDKs. Use constructor injection. Prefer in-memory fakes for unit tests and local adapter integration tests for persistence/process/filesystem boundaries.

## 2.2 TDD rule

Development is test-first: write a focused failing test that states the behavior, implement the smallest change to pass, then refactor while keeping tests green. For each feature, include unit tests for domain/orchestration and contract tests for adapters/protocol boundaries; add end-to-end tests for critical user journeys. Never make real gateway calls or require real credentials in automated tests. CI must run Go tests and TypeScript tests/lint/type-check before merge.

## 3. Authentication and model/provider boundary

### Initial integration path

- The first live path is an explicitly configured OpenAI-compatible Chat Completions endpoint, including self-hosted gateways.
- The user supplies base URL, model, and optional API key. Send no implicit requests before configuration.
- Electron main persists API keys using Electron `safeStorage`; renderer storage and logs never receive a saved key.
- Backend-specific SSE contracts can be adapted to normalized runtime events without changing UI DTOs.

### Provider configuration and credentials

OAuth/OIDC, device auth, model discovery, refresh/logout, and organization identity remain future work. Keep an `AuthProvider` separate from `ModelProvider` when implemented.

### Interfaces

Keep an `AuthProvider` interface responsible for login/refresh/logout and secret references, and a provider-neutral `ModelProvider` interface for completion, streaming, tool calls, and usage metadata. The current first adapter uses OpenAI-compatible Chat Completions.

## 4. Runtime and tool execution

The agent loop follows this sequence:

1. Load conversation state and workspace policy.
2. Build request context from user message and approved local context.
3. Send request through the selected authenticated provider.
4. Validate returned tool calls against registered schemas.
5. Ask the policy engine whether each action is allowed, requires approval, or is denied.
6. Execute an approved action in the tool executor.
7. Persist request, decision, result, and emitted UI event.
8. Continue the model turn or finish the run.

Tool effects should be declared (read, write, execute, network, credential access) and scoped (workspace roots, specific resource/server). The policy engine must enforce scope at execution time, not rely on a UI prompt alone.

Initial provider: OpenAI-compatible chat completions with SSE streaming and function-call deltas. The Electron main process stores the optional API key through OS-backed encryption and configures the runtime. A future backend can implement the same internal provider port using its shared request/SSE contract.

Initial tools: list/read/write files under the selected workspace. Every model-proposed tool waits for an explicit approval response. Search/index, diff review, command execution, terminal, Git operations, and richer policy modes are not implemented yet. Future commands must use structured argv and support cancellation/timeouts.

## 5. Approval and safety model

Represent approval as a policy decision over a concrete action, including tool name, target paths/command, declared effects, and workspace. Initial modes:

- **Ask:** request approval for every write/execute/network action.
- **Workspace:** allow scoped workspace reads and writes; ask before execution/network/out-of-root access.
- **Auto:** allow actions permitted by the user's configured policy, while still denying out-of-scope access and enforcing hard restrictions.

Default to Ask for consequential actions. Approval must be tied to the exact action or a clearly described reusable scope; never turn one approval into unrestricted machine access. Record approve/reject/deny, policy version, and timestamp in the local event history.

## 6. Plugin architecture

Define capability-specific plugin contracts rather than one unrestricted plugin API:

- `model-provider`
- `auth-provider`
- `tool-provider`
- `indexer`
- `ui-extension` (later, constrained)

Each plugin manifest declares ID, version, compatibility range, entry point, capabilities, and requested permissions. Plugins communicate with the host through versioned JSON-RPC messages. Initially support first-party and manually installed/trusted plugins. Run third-party plugins out of process with explicit capability grants; never give renderer plugins direct filesystem, process, credential, or network access.

An MCP client is an integration adapter for external tools/resources, not a replacement for the app's policy engine. Treat returned content/tool descriptions as untrusted input and apply per-server permissions and approval policy.

## 7. Persistence and local data

Use SQLite with migrations for workspaces, conversations, messages, runs, tool calls, approval decisions, provider references, and indexing metadata. Store large tool outputs as bounded records or local blobs with retention controls. Do not store raw auth secrets in SQLite.

Conversation events should preserve order and enough structured detail to resume and audit: user/assistant messages, streaming completion, tool request, policy result, approval response, tool result, errors, cancellation, and run completion. Use transactions for related state transitions. Provide explicit export/delete behavior.

## 8. Workspace navigation and indexing

The workspace service owns the active root and file operations. The right-side explorer requests tree children and file metadata from this service; it does not enumerate arbitrary paths from the renderer. Canonicalize paths and enforce workspace boundaries, including symlink handling, before reads/writes.

Indexing should be incremental and local. Begin with ignore-aware file discovery and text search, exclude `.git`, common dependency/build directories, binary files, secrets, and oversized files by default. Track state/errors per workspace. Add language symbol indexing and embeddings only when demonstrated useful.

## 9. IPC and event contract

Use explicit commands (e.g. `workspace.open`, `run.start`, `run.cancel`, `approval.respond`, `conversation.resume`) and typed events (e.g. `run.delta`, `tool.requested`, `approval.required`, `tool.completed`, `diff.updated`, `index.progress`). Validate all payloads at the process boundary and associate events with conversation/run IDs. Do not expose a generic `invoke arbitrary function` bridge.
