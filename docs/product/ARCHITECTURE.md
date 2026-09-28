# Architecture — v1 baseline

**Docs version:** 1.1.0  
**Status:** Draft baseline  
**Last updated:** 2026-09-28

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
│ Gateway/provider  │ Tool executor       │ Workspace indexing │
│ & auth adapters   │ files/shell/etc.    │ search/symbols      │
├───────────────────┴────────────────────┴────────────────────┤
│ Plugin host / MCP clients / capability and permission checks  │
└───────────────────────────┬─────────────────────────────────┘
                            │
          SQLite + local workspace + OS credential store
```

The UI must not call model APIs or execute tools directly. It communicates with the local runtime using typed commands and subscribes to typed events. The runtime owns agent runs, policy decisions, tool execution, and persistence.

## 2. Suggested implementation stack

V1 language split:

- **UI:** TypeScript, hosted in a cross-platform desktop shell. Electron is the initial recommendation for implementation speed and IDE-like UI ecosystem; keep renderer sandboxing, context isolation, restrictive navigation, and a narrow typed preload/IPC bridge enabled.
- **Agent runtime:** Go, running as a supervised local child process. It owns agent sessions, policy, tool dispatch, workspace operations, provider calls, and durable conversation events.
- **Boundary:** versioned JSON-RPC over stdio or a loopback-only authenticated local transport. Prefer stdio for the first version to avoid opening a local network listener. The transport must support request/response, streaming events, cancellation, and graceful shutdown.

Tauri 2 with a Rust runtime remains a valid alternative only if the desktop shell changes; it does not replace the chosen Go runtime. Keep product and protocol contracts framework-neutral.

## 2.1 Testability and interface-first design

Use small Go interfaces at boundaries where implementations may vary or need isolation in tests. Avoid defining interfaces for every struct or mirroring concrete types without a demonstrated substitution seam. Core application services depend on ports, with adapters supplied at startup.

Initial ports (names illustrative):

- `ModelGateway`: stream model responses/tool proposals; implemented by the gateway adapter and optional direct-provider adapter.
- `Authenticator` / `CredentialStore`: login lifecycle and secure secret references, with OS-specific credential-store adapters.
- `Workspace`: scoped list/read/write/search/stat operations, with filesystem adapter.
- `CommandRunner`: structured command execution, cancellation, output, timeout, and policy context.
- `ConversationRepository`: append/read events and resume session state, with SQLite adapter.
- `ApprovalPolicy` and `ApprovalBroker`: decide allow/ask/deny and deliver requests to the UI boundary.
- `PluginCatalog` / capability interfaces: register providers, tools, and indexers through validated manifests.
- `EventPublisher`: send typed runtime events to UI and tests.

Keep domain and orchestration logic independent from Electron, SQLite, filesystem globals, network clients, and provider SDKs. Use constructor injection. Prefer in-memory fakes for unit tests and local adapter integration tests for persistence/process/filesystem boundaries.

## 2.2 TDD rule

Development is test-first: write a focused failing test that states the behavior, implement the smallest change to pass, then refactor while keeping tests green. For each feature, include unit tests for domain/orchestration and contract tests for adapters/protocol boundaries; add end-to-end tests for critical user journeys. Never make real gateway calls or require real credentials in automated tests. CI must run Go tests and TypeScript tests/lint/type-check before merge.

## 3. Authentication and model/provider boundary

### Required standard path

- A configured gateway is the default and required authentication target.
- The app must not permit an unauthenticated model request.
- Auth is an adapter, separate from provider/model transport. It may use OAuth/OIDC, device authorization, browser-based SSO, or a gateway-specific flow.
- Tokens/secrets are stored in Windows Credential Manager/macOS Keychain (or a vetted cross-platform OS credential abstraction), not plaintext settings or SQLite.
- The runtime attaches credentials to gateway requests and handles expiry, refresh, logout, and safe error reporting.
- Do not silently switch to direct vendor access when gateway auth fails.

### Optional direct API key

Direct API-key configuration is an advanced, optional provider path. It must be explicitly enabled and labeled as bypassing the configured gateway. Store the key in the OS credential store. Keep its configuration isolated from gateway credentials, and make the active route/provider visible in the UI.

### Interfaces

Keep an `AuthProvider` interface responsible for login/refresh/logout and secret references, and a `ModelProvider` interface responsible for model discovery, streaming responses, tool-call exchange, and usage metadata. A gateway can implement `ModelProvider` while using a separate auth adapter. A compatible gateway may use an OpenAI-compatible adapter; do not bake that assumption into the core runtime.

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

Core v1 tools: list/search/read workspace files, apply file edits, inspect diff, and run a command through an OS-specific execution layer. Avoid shell string interpolation; pass structured argv where possible, capture stdout/stderr/exit status, support cancellation and timeouts, and isolate environment variables/secrets.

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

